import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

/**
 * Global AI Gateway Route
 * -----------------------
 * Forwards all incoming requests directly to the Python AI Mail Agent.
 */

export const maxDuration = 60; // Allow up to 60 seconds for AI processing

const AI_MAIL_SERVICE_URL = "http://localhost:8001/api/mail/ai-dispatch";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // FALLBACK: If context is missing or empty, fetch it from DB using the teacher's session
    let context = body.context || [];
    
    if (context.length === 0) {
      try {
        const user = await getCurrentUser(req);
        if (user && user.role === "TEACHER" && user.profileId) {
          console.log("🔍 [AI_GATEWAY]: Context empty, fetching assignments from DB...");
          const assignmentsData = await prisma.teacherSubjectAssignment.findMany({
            where: { teacher_id: BigInt(user.profileId), assignment_status: "ACTIVE" },
            include: {
              subject: { select: { subject_id: true, subject_name: true } },
              section: { select: { section_id: true, section_name: true } },
              batch: { select: { batch_name: true } }
            }
          });

          context = assignmentsData.map(a => ({
            subject_name: a.subject?.subject_name,
            subject_id: a.subject?.subject_id?.toString(),
            section_name: a.section?.section_name,
            section_id: a.section?.section_id?.toString(),
            batch_name: a.batch?.batch_name
          }));
          
          console.log(`✅ [AI_GATEWAY]: Found ${context.length} assignments for context.`);
        }
      } catch (err) {
        console.error("⚠️ [AI_GATEWAY]: Failed to fetch fallback context:", err);
      }
    }

    const payload = {
      ...body,
      context: context
    };

    console.log("🚀 [AI_GATEWAY_DISPATCH]: Sending task to Mail Agent...");
    console.log("📝 Message:", payload.message);
    console.log("📦 Context:", JSON.stringify(payload.context, null, 2));

    const response = await fetch(AI_MAIL_SERVICE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { 
          success: false, 
          error: data.detail || data.error || "AI Microservice returned an error." 
        }, 
        { status: response.status }
      );
    }

    return NextResponse.json(data);

  } catch (error: any) {
    console.error("❌ [AI_GATEWAY_ERROR]:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: "AI Microservice is unreachable or timed out. Ensure the Python server is running." 
      }, 
      { status: 502 }
    );
  }
}
