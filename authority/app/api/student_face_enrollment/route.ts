import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { promises as fs } from "fs";
import path from "path";
import { getCurrentUser } from "@/lib/session";

const REQUIRED_ANGLES = ["front", "left", "right"] as const;

// Standardized CORS headers for Mobile/Web compatibility
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, ngrok-skip-browser-warning",
};

// Helper for BigInt serialization
const safeJson = (obj: any) => JSON.stringify(obj, (_, v) => typeof v === "bigint" ? v.toString() : v);

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(request: NextRequest) {
    try {
        // 1. Secure Identity Check
        const user = await getCurrentUser(request);
        if (!user || user.role !== "STUDENT") {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401, headers: corsHeaders });
        }

        const studentId = BigInt(user.profileId);
        const body = await request.json();
        const { face_samples } = body;

        // 2. Validate Payload
        if (!Array.isArray(face_samples) || face_samples.length !== REQUIRED_ANGLES.length) {
            return NextResponse.json({ 
                success: false,
                error: "Invalid face_samples. Exactly 3 samples are required: front, left, right."
            }, { status: 400, headers: corsHeaders });
        }

        const normalizedSamples: Array<{ angle: string; image_b64: string }> = [];
        const seenAngles = new Set<string>();

        for (const sample of face_samples) {
            const angle = String(sample?.angle ?? "").toLowerCase().trim();
            const image_b64 = String(sample?.image_b64 ?? "").trim();

            if (!REQUIRED_ANGLES.includes(angle as (typeof REQUIRED_ANGLES)[number])) {
                return NextResponse.json({
                    success: false,
                    error: `Invalid angle '${String(sample?.angle ?? "")}'. Required: front, left, right.`
                }, { status: 400, headers: corsHeaders });
            }

            if (!image_b64) {
                return NextResponse.json({ success: false, error: `Missing image data for ${angle} angle.` }, { status: 400, headers: corsHeaders });
            }

            if (seenAngles.has(angle)) {
                return NextResponse.json({ success: false, error: `Duplicate angle: ${angle}.` }, { status: 400, headers: corsHeaders });
            }

            seenAngles.add(angle);
            normalizedSamples.push({ angle, image_b64 });
        }

        // 3. Prepare upload directory
        const uploadDir = path.join(process.cwd(), "public", "uploads", "faces");
        await fs.mkdir(uploadDir, { recursive: true });

        // 4. Processing Loop (Parallel with Python Microservice)
        const processingPromises = normalizedSamples.map(async (sample) => {
            const { angle, image_b64 } = sample;

            // Strip metadata
            const base64Data = image_b64.replace(/^data:image\/\w+;base64,/, "");
            const buffer = Buffer.from(base64Data, "base64");

            // Forward to AI Pipeline
            const formData = new FormData();
            const blob = new Blob([buffer], { type: "image/jpeg" });
            formData.append("image", blob, `${studentId}_${angle}.jpg`);

            const pythonRes = await fetch("http://127.0.0.1:8000/api/v1/enroll", {
                method: "POST",
                body: formData,
            });

            const pythonData = await pythonRes.json();

            if (!pythonRes.ok) {
                throw new Error(JSON.stringify({ angle, details: pythonData }));
            }

            // Save valid image
            const fileName = `${studentId}_${angle}_${Date.now()}.jpg`;
            const filePath = path.join(uploadDir, fileName);
            await fs.writeFile(filePath, buffer);

            return {
                student_id: studentId,
                image_path: `/uploads/faces/${fileName}`,
                face_encoding: JSON.stringify(pythonData.vector),
                dataset_version: "v1.0",
                capture_date: new Date(),
                image_quality_score: pythonData.confidence,
                status: "ACTIVE",
                model_name: "ArcFace",
                face_angle: angle,
                is_primary: angle === "front"
            };
        });

        let savedFaces;
        try {
            savedFaces = await Promise.all(processingPromises);
        } catch (e: any) {
            let errorInfo = { angle: "unknown", details: "Validation failed" };
            try { errorInfo = JSON.parse(e.message); } catch {}
            return NextResponse.json({ 
                success: false,
                error: `AI Validation failed for ${errorInfo.angle} angle.`, 
                details: errorInfo.details 
            }, { status: 400, headers: corsHeaders });
        }

        // 5. Database Transaction
        await prisma.$transaction([
            prisma.faceData.updateMany({
                where: { student_id: studentId, status: "ACTIVE" },
                data: { status: "INACTIVE" }
            }),
            prisma.faceData.createMany({ data: savedFaces })
        ]);

        return new Response(safeJson({ 
            success: true, 
            message: "Face enrollment successful.",
            records_created: savedFaces.length,
            angles: savedFaces.map(f => f.face_angle)
        }), {
            status: 201,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });

    } catch (error: unknown) {
        console.error("Face Enrollment Error:", error);
        return NextResponse.json({ 
            success: false,
            error: "Internal Server Error", 
            message: error instanceof Error ? error.message : String(error)
        }, { status: 500, headers: corsHeaders });
    }
}
