import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { promises as fs } from "fs";
import path from "path";

const REQUIRED_ANGLES = ["front", "left", "right"] as const;

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { student_id, face_samples } = body;

        // 1. Validate payload
        const studentIdText = String(student_id ?? "").trim();
        if (!/^\d+$/.test(studentIdText)) {
            return NextResponse.json({
                error: "Invalid student_id. It must be numeric."
            }, { status: 400 });
        }

        if (!Array.isArray(face_samples) || face_samples.length !== REQUIRED_ANGLES.length) {
            return NextResponse.json({ 
                error: "Invalid face_samples. Exactly 3 samples are required: front, left, right."
            }, { status: 400 });
        }

        const normalizedSamples: Array<{ angle: string; image_b64: string }> = [];
        const seenAngles = new Set<string>();

        for (const sample of face_samples) {
            const angle = String(sample?.angle ?? "").toLowerCase().trim();
            const image_b64 = String(sample?.image_b64 ?? "").trim();

            if (!REQUIRED_ANGLES.includes(angle as (typeof REQUIRED_ANGLES)[number])) {
                return NextResponse.json({
                    error: `Invalid angle '${String(sample?.angle ?? "")}'. Allowed values are front, left, right.`
                }, { status: 400 });
            }

            if (!image_b64) {
                return NextResponse.json({
                    error: `Missing image data for ${angle} angle.`
                }, { status: 400 });
            }

            if (seenAngles.has(angle)) {
                return NextResponse.json({
                    error: `Duplicate angle detected: ${angle}. Provide each angle only once.`
                }, { status: 400 });
            }

            seenAngles.add(angle);
            normalizedSamples.push({ angle, image_b64 });
        }

        for (const requiredAngle of REQUIRED_ANGLES) {
            if (!seenAngles.has(requiredAngle)) {
                return NextResponse.json({
                    error: "face_samples must include one each of: front, left, right."
                }, { status: 400 });
            }
        }

        const parsedStudentId = BigInt(studentIdText);

        // Verify if the student exists in the database
        const student = await prisma.student.findUnique({
            where: { student_id: parsedStudentId }
        });

        if (!student) {
            return NextResponse.json({ error: "Student not found in database." }, { status: 404 });
        }

        // Prepare local upload directory
        const uploadDir = path.join(process.cwd(), "public", "uploads", "faces");
        await fs.mkdir(uploadDir, { recursive: true });

        const savedFaces = [];

        // 2. Loop through each angle (Front, Left, Right)
        for (const sample of normalizedSamples) {
            const { angle, image_b64 } = sample;

            // Remove base64 metadata prefix if sent by the frontend 
            const base64Data = image_b64.replace(/^data:image\/\w+;base64,/, "");
            const buffer = Buffer.from(base64Data, "base64");

            // 3. Send image to our Python DeepFace Microservice
            const formData = new FormData();
            
            // Note: Next.js standard fetch FormData takes Blobs 
            const blob = new Blob([buffer], { type: "image/jpeg" });
            formData.append("image", blob, `${student_id}_${angle}.jpg`);

            const pythonRes = await fetch("http://localhost:8000/api/v1/enroll", {
                method: "POST",
                body: formData,
            });

            const pythonData = await pythonRes.json();

            // 4. Handle Python Validations (0 faces, >1 faces, low confidence)
            if (!pythonRes.ok) {
                return NextResponse.json({ 
                    error: `Validation failed for ${angle} angle.`, 
                    details: pythonData 
                }, { status: 400 });
            }

            // 5. Store valid image on disk
            // Unique filename specifically for caching prevention
            const fileName = `${student_id}_${angle}_${Date.now()}.jpg`;
            const filePath = path.join(uploadDir, fileName);
            await fs.writeFile(filePath, buffer);

            const dbImagePath = `/uploads/faces/${fileName}`;
            const isPrimary = angle.toLowerCase() === "front";

            // 6. Push to array to Bulk Create
            savedFaces.push({
                student_id: parsedStudentId,
                image_path: dbImagePath,
                face_encoding: JSON.stringify(pythonData.vector), // The 512-d ArcFace vector!
                dataset_version: "v1.0", // Hardcoded safely!
                capture_date: new Date(),
                image_quality_score: pythonData.confidence,
                status: "ACTIVE",
                model_name: "ArcFace", // Hardcoded to ArcFace via DeepFace
                face_angle: angle,
                is_primary: isPrimary
            });
        }

        // 7. Database Persistence
        // First (Optional but recommended): Mark old active vectors for this student as INACTIVE
        await prisma.faceData.updateMany({
            where: { 
                student_id: parsedStudentId,
                status: "ACTIVE"
            },
            data: { status: "INACTIVE" }
        });

        // Bulk insert new approved face vectors
        const newFaceData = await prisma.faceData.createMany({
            data: savedFaces
        });

        // 8. Custom JSON.stringify to handle Prisma's BigInts
        const safeStringify = (obj: unknown) => JSON.stringify(obj, (key, value) =>
            typeof value === "bigint" ? value.toString() : value
        );

        return new Response(safeStringify({ 
            success: true, 
            message: "Student face data enrolled and saved seamlessly.",
            records_created: newFaceData.count,
            angles_saved: savedFaces.map(sf => sf.face_angle)
        }), {
            status: 201,
            headers: { "Content-Type": "application/json" }
        });

    } catch (error: unknown) {
        console.error("Student Enrollment Error:", error);
        return NextResponse.json({ 
            error: "Internal Server Error", 
            message: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}
