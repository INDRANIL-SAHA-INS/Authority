import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

/**
 * TEACHER MARKS UPLOAD API
 * -------------------------
 * This endpoint initiates the asynchronous marks extraction process.
 * It authorizes the teacher, creates a job tracker, and forwards the file
 * to the Python microservice for AI-powered mapping and extraction.
 */
// TOGGLE THIS TO TRUE TO BYPASS AUTH AND ASSIGNMENT CHECKS
const DEVELOPMENT_PHASE_ON = true;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(req: NextRequest) {
  try {
    // 1. Authorization (Always try to get the current user)
    const user = await getCurrentUser(req);
    let teacherId: bigint;

    if (user && user.role === "TEACHER") {
      teacherId = BigInt(user.profileId);
      if (DEVELOPMENT_PHASE_ON) {
        console.log(`[DEV MODE] Authenticated teacher found. Using teacherId: ${teacherId}`);
      }
    } else if (DEVELOPMENT_PHASE_ON) {
      // Fallback to mock ID only if no user is found and we are in dev mode
      teacherId = BigInt(1); 
      console.log("[DEV MODE] No authenticated teacher session. Falling back to mock ID 1.");
    } else {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const sectionId = formData.get("sectionId") as string;
    const subjectId = formData.get("subjectId") as string;
    const examType = formData.get("examType") as string;

    if (!file || !sectionId || !subjectId || !examType) {
      return NextResponse.json({ success: false, message: "Missing required fields" }, { status: 400, headers: corsHeaders });
    }

    // 2. Resolve Active Period Internally
    const activePeriod = await prisma.academicPeriod.findFirst({
      where: { is_active: true }
    });

    if (!activePeriod) {
      return NextResponse.json({ 
        success: false, 
        message: "No active academic period found. Please contact admin." 
      }, { status: 500, headers: corsHeaders });
    }

    // 3. Authorization Check (Bypassed if DEVELOPMENT_PHASE_ON is true)
    if (!DEVELOPMENT_PHASE_ON) {
      const assignment = await prisma.teacherSubjectAssignment.findFirst({
        where: {
          teacher_id: teacherId,
          subject_id: BigInt(subjectId),
          section_id: BigInt(sectionId),
          assignment_status: "ACTIVE"
        }
      });

      if (!assignment) {
        return NextResponse.json({ 
          success: false, 
          message: "Access Denied: You are not assigned to this subject and section." 
        }, { status: 403, headers: corsHeaders });
      }
    }

    // 4. Create Job Tracker in DB
    const job = await prisma.marksUploadJob.create({
      data: {
        teacher_id: teacherId,
        file_name: file.name,
        status: "PROCESSING"
      }
    });

    // 5. Trigger Python Microservice (Asynchronous)
    const microserviceUrl = process.env.MICROSERVICE_URL || "http://localhost:8001";
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const msForm = new FormData();
    msForm.append("file", file);
    msForm.append("job_id", job.job_id);
    
    // Construct Callback URL with Metadata in Query Params
    const callbackUrl = `${appUrl}/api/teacher/marks_upload/call_backs?` + 
                        new URLSearchParams({
                          sectionId,
                          subjectId,
                          examType,
                          periodId: activePeriod.period_id.toString()
                        }).toString();
    
    msForm.append("callback_url", callbackUrl);

    // Fire and forget (Background processing in Python)
    fetch(`${microserviceUrl}/api/marks/async-extract`, {
      method: "POST",
      body: msForm
    }).catch(err => {
      console.error("[MarksUpload] Failed to trigger microservice:", err);
      prisma.marksUploadJob.update({
        where: { job_id: job.job_id },
        data: { status: "FAILED", error_message: "Marks extraction service unreachable." }
      }).catch(console.error);
    });

    return NextResponse.json({ 
      success: true, 
      message: "Upload started successfully.",
      jobId: job.job_id 
    }, { headers: corsHeaders });

  } catch (error: any) {
    console.error("[MarksUpload API Error]:", error);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500, headers: corsHeaders });
  }
}
