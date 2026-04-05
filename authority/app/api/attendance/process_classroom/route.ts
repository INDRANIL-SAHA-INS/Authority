import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import fs from "fs";
import path from "path";

// Euclidean distance helper for face matching (L2 Norm)
function calculateEuclideanDistance(v1: number[], v2: number[]): number {
  if (v1.length !== v2.length) return Infinity;
  return Math.sqrt(v1.reduce((sum, val, i) => sum + Math.pow(val - v2[i], 2), 0));
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { timetable_id, image_b64 } = body;

    if (!timetable_id || !image_b64) {
      return NextResponse.json({ error: "Missing required data" }, { status: 400 });
    }

    // 1. Fetch Complete Timetable Context
    const timetable = await prisma.timetable.findUnique({
      where: { timetable_id: BigInt(timetable_id) },
    });

    if (!timetable) return NextResponse.json({ error: "Invalid Timetable" }, { status: 404 });

    // 2. Fetch Reference Face Data (O(N*M) optimization - Only for this section)
    const referenceFaces = await prisma.faceData.findMany({
      where: {
        student: { section_id: timetable.section_id },
        status: "ACTIVE"
      },
      select: { student_id: true, face_encoding: true }
    });

    // 3. Process image and trigger AI service
    const uploadDir = path.join(process.cwd(), "public", "uploads", "classroom_sessions");
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    
    const base64Data = image_b64.replace(/^data:image\/\w+;base64,/, "");
    const fileName = `session_${timetable_id}_${Date.now()}.jpg`;
    fs.writeFileSync(path.join(uploadDir, fileName), Buffer.from(base64Data, "base64"));
    const photoUrl = `/uploads/classroom_sessions/${fileName}`;

    const pythonServiceUrl = process.env.PYTHON_AI_SERVICE_URL || "http://127.0.0.1:8000";
    const formData = new FormData();
    formData.append("image", new Blob([Buffer.from(base64Data, "base64")]), "class.jpg");

    const pythonRes = await fetch(`${pythonServiceUrl}/api/attendance/process_classroom`, {
        method: "POST",
        body: formData
    });

    if (!pythonRes.ok) throw new Error("AI Microservice Engine Failed");
    const aiData = await pythonRes.json();
    
    // Check if any faces were found at all
    if (aiData.faces_found === 0) {
        return NextResponse.json({ 
            error: "NO_FACES_DETECTED", 
            message: "No faces could be identified in this photo. Please ensure students are visible and try again." 
        }, { status: 422 });
    }

    const detectedFaces = aiData.detections || [];

    // 4. Vector Comparison matching Logic
    const MATCH_THRESHOLD = 0.65;
    const matchedSids = new Set<string>();
    const matchedCrops = new Map<string, string>();

    for (const det of detectedFaces) {
        let bestSid = null;
        let minDistance = Infinity;

        for (const ref of referenceFaces) {
            try {
                const dist = calculateEuclideanDistance(det.vector, JSON.parse(ref.face_encoding!));
                if (dist < MATCH_THRESHOLD && dist < minDistance) {
                    minDistance = dist;
                    bestSid = ref.student_id.toString();
                }
            } catch { continue; }
        }

        if (bestSid) {
            matchedSids.add(bestSid);
            matchedCrops.set(bestSid, det.crop_b64);
        }
    }

    // 5. ULTIMATE PERFORMANCE: Atomic Database Transaction
    // We mark everything AND update summaries in ONE single execution.
    const allStudents = await prisma.student.findMany({
        where: { section_id: timetable.section_id }
    });

    const result = await prisma.$transaction(async (tx) => {
        // A. Upsert the Main Attendance Session
        const session = await tx.attendanceSession.upsert({
            where: {
                timetable_id_session_date: {
                    timetable_id: BigInt(timetable_id),
                    session_date: new Date(new Date().setHours(0, 0, 0, 0))
                }
            },
            update: { class_photo_url: photoUrl },
            create: {
                timetable_id: BigInt(timetable_id),
                session_date: new Date(new Date().setHours(0, 0, 0, 0)),
                class_photo_url: photoUrl,
                teacher_id: timetable.teacher_id,
                subject_id: timetable.subject_id,
                batch_id: timetable.batch_id,
                section_id: timetable.section_id,
                classroom_id: timetable.classroom_id,
                total_students: allStudents.length,
                present_count: matchedSids.size,
                absent_count: allStudents.length - matchedSids.size
            }
        });

        // B. Mass Mark Attendance Records & Atomic Summaries
        for (const student of allStudents) {
            const sidStr = student.student_id.toString();
            const isPresent = matchedSids.has(sidStr);
            let localProofUrl = null;

            // Save crop proof if present
            if (isPresent && matchedCrops.has(sidStr)) {
                const cropDir = path.join(process.cwd(), "public", "uploads", "attendance_crops");
                if (!fs.existsSync(cropDir)) fs.mkdirSync(cropDir, { recursive: true });
                const proofName = `proof_${sidStr}_session_${session.session_id}.jpg`;
                fs.writeFileSync(path.join(cropDir, proofName), Buffer.from(matchedCrops.get(sidStr)!, "base64"));
                localProofUrl = `/uploads/attendance_crops/${proofName}`;
            }

            // Mark individual record
            await tx.attendanceRecord.upsert({
                where: {
                    session_id_student_id: {
                        session_id: session.session_id,
                        student_id: student.student_id
                    }
                },
                update: { attendance_status: isPresent ? "PRESENT" : "ABSENT", captured_face_url: localProofUrl },
                create: {
                    session_id: session.session_id,
                    student_id: student.student_id,
                    attendance_status: isPresent ? "PRESENT" : "ABSENT",
                    captured_face_url: localProofUrl
                }
            });

            // PRE-CALCULATE ACCURACY: Update AttendanceSummary for Student Dashboard
            // This increments the 'scoreboard' in real-time
            await tx.attendanceSummary.upsert({
                where: {
                    student_id_subject_id_period_id: {
                        student_id: student.student_id,
                        subject_id: timetable.subject_id,
                        period_id: timetable.period_id
                    }
                },
                update: {
                    total_classes: { increment: 1 },
                    classes_attended: { increment: isPresent ? 1 : 0 },
                    classes_missed: { increment: isPresent ? 0 : 1 },
                    // percentage will be updated via a separate periodic clean-up or computed on-display
                    last_updated: new Date()
                },
                create: {
                    student_id: student.student_id,
                    subject_id: timetable.subject_id,
                    period_id: timetable.period_id,
                    total_classes: 1,
                    classes_attended: isPresent ? 1 : 0,
                    classes_missed: isPresent ? 0 : 1,
                    attendance_percentage: isPresent ? 100 : 0
                }
            });
        }

        return session;
    });

    const safeStringify = (obj: any) =>
      JSON.stringify(obj, (key, value) => (typeof value === "bigint" ? value.toString() : value));

    return new Response(safeStringify({
      success: true,
      data: {
          session_id: result.session_id,
          present_count: matchedSids.size,
          total_faces: detectedFaces.length
      }
    }), { status: 200, headers: { "Content-Type": "application/json" } });

  } catch (err: any) {
    console.error("[PERFORMANCE ENGINE] Process Fail:", err);
    return NextResponse.json({ error: "Pipeline Fault", details: err.message }, { status: 500 });
  }
}
