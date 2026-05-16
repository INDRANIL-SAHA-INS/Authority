import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { generateSnowflake } from "@/lib/snowflake";

// Standardized CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, ngrok-skip-browser-warning",
};

// Shared BigInt serializer
const safeJson = (obj: any) =>
  JSON.stringify(obj, (_, v) => (typeof v === "bigint" ? v.toString() : v));

// Cosine Similarity Utility
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  let dotProduct = 0;
  let mA = 0;
  let mB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    mA += vecA[i] * vecA[i];
    mB += vecB[i] * vecB[i];
  }
  mA = Math.sqrt(mA);
  mB = Math.sqrt(mB);
  if (mA === 0 || mB === 0) return 0;
  return dotProduct / (mA * mB);
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

/**
 * POST /api/teacher/attendance/submit
 * 
 * 1. Validates Teacher & Timetable.
 * 2. Fetches only students enrolled in this section/subject.
 * 3. Sends classroom image to Python AI service for face extraction.
 * 4. Matches extracted vectors against enrolled student embeddings.
 * 5. Atomically saves Session + Records (Present/Absent).
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Auth & Teacher Check
    const currentUser = await getCurrentUser(req);
    if (!currentUser || currentUser.role !== "TEACHER") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }
    const teacherId = BigInt(currentUser.profileId);

    // 2. Parse Multipart Data (Images + Metadata)
    const formData = await req.formData();
    // Support multiple files sent either as "image" or "images" keys
    const allFormDataEntries = Array.from(formData.entries());
    const images = allFormDataEntries
      .filter(([key, val]) => (key === "image" || key === "images" || key === "images[]") && val instanceof File)
      .map(([_, val]) => val as File);
      
    const timetableIdStr = formData.get("timetable_id") as string;

    if (images.length === 0 || !timetableIdStr) {
      return NextResponse.json({ success: false, message: "At least one image and timetable_id are required" }, { status: 400, headers: corsHeaders });
    }

    if (images.length > 3) {
      return NextResponse.json({ success: false, message: "Maximum 3 images allowed per request" }, { status: 400, headers: corsHeaders });
    }

    const timetableId = BigInt(timetableIdStr);

    // 3. Fetch Timetable & Active Period
    const activePeriod = await prisma.academicPeriod.findFirst({ where: { is_active: true } });
    const timetable = await prisma.timetable.findUnique({
      where: { timetable_id: timetableId },
      include: { time_slot: true }
    });

    if (!timetable || !activePeriod) {
      return NextResponse.json({ success: false, message: "Timetable or Active Period not found" }, { status: 404, headers: corsHeaders });
    }

    if (timetable.teacher_id !== teacherId) {
      return NextResponse.json({ success: false, message: "Forbidden: Not your class" }, { status: 403, headers: corsHeaders });
    }

    // 4. Fetch Enrolled Students with their Face Embeddings
    const enrolledStudents = await prisma.student.findMany({
      where: {
        enrollments: {
          some: {
            subject_id: timetable.subject_id,
            period_id: activePeriod.period_id,
            status: "ACTIVE"
          }
        },
        section_id: timetable.section_id
      },
      include: {
        face_data: {
          where: { status: "ACTIVE" }
        }
      }
    });

    if (enrolledStudents.length === 0) {
      return NextResponse.json({ success: false, message: "No students enrolled in this class" }, { status: 400, headers: corsHeaders });
    }

    // 5. Send Images to Python AI Microservice Concurrently
    const pythonAiUrl = "http://localhost:8000/api/attendance/process_classroom";
    
    const aiRequests = images.map(async (img) => {
      const aiFormData = new FormData();
      aiFormData.append("image", img);

      const aiResponse = await fetch(pythonAiUrl, {
        method: "POST",
        body: aiFormData
      });

      if (!aiResponse.ok) {
        throw new Error(`AI Microservice failed to process image: ${img.name}`);
      }

      const aiData = await aiResponse.json();
      return aiData.detections.map((d: any) => d.vector) as number[][];
    });

    // Wait for all images to be processed
    const results = await Promise.all(aiRequests);
    const allDetectedVectors: number[][] = results.flat(); // Flatten into one giant array of vectors

    // 6. Matching Logic (Next.js Side)
    const SIMILARITY_THRESHOLD = 0.65; // Adjust based on model (ArcFace/RetinaFace)
    
    // Using a Set inherently solves the deduplication problem!
    // Even if a student is found in 3 different photos, their ID is only added once.
    const presentStudentIds = new Set<bigint>();

    // For each face detected across all photos...
    for (const detectedVec of allDetectedVectors) {
      let bestMatchId: bigint | null = null;
      let highestSimilarity = -1;

      // ...compare against only enrolled students
      for (const student of enrolledStudents) {
        for (const face of student.face_data) {
          if (!face.face_encoding) continue;
          
          try {
            const dbVec = JSON.parse(face.face_encoding) as number[];
            const sim = cosineSimilarity(detectedVec, dbVec);
            
            if (sim > SIMILARITY_THRESHOLD && sim > highestSimilarity) {
              highestSimilarity = sim;
              bestMatchId = student.student_id;
            }
          } catch (e) {
            console.error(`Error parsing embedding for student ${student.student_id}`);
          }
        }
      }

      if (bestMatchId) {
        presentStudentIds.add(bestMatchId);
      }
    }

    // 7. Atomic DB Update (Session + Records)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const result = await prisma.$transaction(async (tx) => {
      // Check for existing session first to determine if we are creating or updating
      const existingSession = await tx.attendanceSession.findUnique({
        where: { timetable_id_session_date: { timetable_id: timetableId, session_date: today } }
      });

      const session = await tx.attendanceSession.upsert({
        where: { timetable_id_session_date: { timetable_id: timetableId, session_date: today } },
        update: {
          total_students: enrolledStudents.length,
          present_count: presentStudentIds.size,
          absent_count: enrolledStudents.length - presentStudentIds.size,
          attendance_method: "AI_FACE_RECOGNITION"
        },
        create: {
          session_id: generateSnowflake(),
          timetable_id: timetable.timetable_id,
          teacher_id: timetable.teacher_id,
          subject_id: timetable.subject_id,
          batch_id: timetable.batch_id,
          section_id: timetable.section_id,
          classroom_id: timetable.classroom_id,
          session_date: today,
          start_time: timetable.time_slot?.start_time,
          end_time: timetable.time_slot?.end_time,
          total_students: enrolledStudents.length,
          present_count: presentStudentIds.size,
          absent_count: enrolledStudents.length - presentStudentIds.size,
          attendance_method: "AI_FACE_RECOGNITION"
        }
      });

      // Map every enrolled student to a record and sync summary
      const attendanceRecords = await Promise.all(
        enrolledStudents.map(async (student) => {
          const isPresent = presentStudentIds.has(student.student_id);
          
          // 1. Check if record exists for this student/session
          const existingRecord = await tx.attendanceRecord.findUnique({
            where: {
              session_id_student_id: {
                session_id: session.session_id,
                student_id: student.student_id,
              }
            }
          });

          // 2. Upsert record
          const record = await tx.attendanceRecord.upsert({
            where: {
              session_id_student_id: {
                session_id: session.session_id,
                student_id: student.student_id,
              }
            },
            update: {
              attendance_status: isPresent ? "PRESENT" : "ABSENT",
              marked_by: "AI_SYSTEM",
              remarks: isPresent ? "Detected via Face Recognition" : "Not detected in class photo"
            },
            create: {
              attendance_id: generateSnowflake(),
              session_id: session.session_id,
              student_id: student.student_id,
              attendance_status: isPresent ? "PRESENT" : "ABSENT",
              marked_by: "AI_SYSTEM",
              remarks: isPresent ? "Detected via Face Recognition" : "Not detected in class photo"
            }
          });

          // 3. Update AttendanceSummary (ONLY if we are creating a new session or the status changed)
          // For simplicity and accuracy, we always recalculate if the status changed OR if it's a new session.
          if (!existingSession || !existingRecord || existingRecord.attendance_status !== record.attendance_status) {
            const currentSummary = await tx.attendanceSummary.findUnique({
              where: {
                student_id_subject_id_period_id: {
                  student_id: student.student_id,
                  subject_id: timetable.subject_id,
                  period_id: activePeriod.period_id
                }
              }
            });

            // If it's a completely new session (not an update to an existing one), increment total
            const isNewSession = !existingSession;
            const isNewRecord = !existingRecord;

            let nTotal = currentSummary?.total_classes || 0;
            let nAttended = currentSummary?.classes_attended || 0;
            
            if (isNewSession || isNewRecord) {
              nTotal += 1;
              if (isPresent) nAttended += 1;
            } else {
              // It's an update. Total classes remains same. Just check if status flipped.
              if (existingRecord.attendance_status === "ABSENT" && isPresent) {
                nAttended += 1;
              } else if (existingRecord.attendance_status === "PRESENT" && !isPresent) {
                nAttended -= 1;
              }
            }

            const nPercentage = nTotal > 0 ? (nAttended / nTotal) * 100 : 0;
            const nSafeBunks = nTotal > 0 ? Math.floor(nAttended / 0.8) - nTotal : 0;

            await tx.attendanceSummary.upsert({
              where: {
                student_id_subject_id_period_id: {
                  student_id: student.student_id,
                  subject_id: timetable.subject_id,
                  period_id: activePeriod.period_id
                }
              },
              update: {
                total_classes: nTotal,
                classes_attended: nAttended,
                classes_missed: nTotal - nAttended,
                attendance_percentage: nPercentage,
                safe_bunks: nSafeBunks,
                last_updated: new Date()
              },
              create: {
                summary_id: generateSnowflake(),
                student_id: student.student_id,
                subject_id: timetable.subject_id,
                period_id: activePeriod.period_id,
                total_classes: 1,
                classes_attended: isPresent ? 1 : 0,
                classes_missed: isPresent ? 0 : 1,
                attendance_percentage: isPresent ? 100 : 0,
                safe_bunks: isPresent ? 0 : -1
              }
            });
          }

          return record;
        })
      );

      return { session, attendanceRecords };
    });


    return new NextResponse(
      safeJson({
        success: true,
        message: "AI Attendance processed successfully",
        data: {
          sessionId: result.session.session_id.toString(),
          totalStudents: enrolledStudents.length,
          presentCount: presentStudentIds.size,
          absentCount: enrolledStudents.length - presentStudentIds.size
        }
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error) {
    console.error("AI Attendance Submission Error:", error);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500, headers: corsHeaders });
  }
}
