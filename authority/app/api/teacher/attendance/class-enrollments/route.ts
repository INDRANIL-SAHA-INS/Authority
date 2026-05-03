import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

// Standardized CORS headers
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

/**
 * GET /api/teacher/attendance/class-enrollments?subject_id=...&section_id=...
 * Fetches the list of students for a specific subject and section with their attendance stats.
 * Secure: Only accessible by the assigned teacher.
 */
export async function GET(req: NextRequest) {
  try {
    // 1. Identity & Role Verification
    const user = await getCurrentUser(req);
    if (!user || user.role !== "TEACHER") {
      return NextResponse.json({ success: false, message: "Unauthorized: Teacher access required" }, { status: 401, headers: corsHeaders });
    }

    const { searchParams } = new URL(req.url);
    const subjectIdStr = searchParams.get("subject_id");
    const sectionIdStr = searchParams.get("section_id");

    if (!subjectIdStr || !sectionIdStr) {
      return NextResponse.json({ success: false, message: "subject_id and section_id are required" }, { status: 400, headers: corsHeaders });
    }

    const subjectId = BigInt(subjectIdStr);
    const sectionId = BigInt(sectionIdStr);

    // 2. Resolve Teacher Identity
    const teacher = await prisma.teacher.findUnique({
      where: { user_id: BigInt(user.id) }
    });

    if (!teacher) {
      return NextResponse.json({ success: false, message: "Teacher profile not found" }, { status: 404, headers: corsHeaders });
    }

    // 3. Authorization Check: Is this teacher assigned to this specific subject and section?
    const assignment = await prisma.teacherSubjectAssignment.findFirst({
      where: {
        teacher_id: teacher.teacher_id,
        subject_id: subjectId,
        section_id: sectionId,
        assignment_status: "ACTIVE"
      }
    });

    if (!assignment) {
      return NextResponse.json({ success: false, message: "Access Denied: You are not assigned to this class" }, { status: 403, headers: corsHeaders });
    }

    // 4. Find the current active academic period
    const activePeriod = await prisma.academicPeriod.findFirst({
      where: { is_active: true }
    });

    if (!activePeriod) {
      return NextResponse.json({ success: false, message: "No active academic period found" }, { status: 404, headers: corsHeaders });
    }

    // 5. Fetch students enrolled in this subject for this section
    const enrollments = await prisma.subjectEnrollment.findMany({
      where: {
        subject_id: subjectId,
        period_id: activePeriod.period_id,
        status: "ACTIVE",
        student: { section_id: sectionId }
      },
      include: {
        student: {
          select: {
            student_id: true,
            university_roll_number: true,
            first_name: true,
            last_name: true,
            user: { select: { profile_image_url: true } },
            batch: { select: { batch_name: true } },
            program: { select: { program_name: true } },
            attendance_summaries: {
              where: { subject_id: subjectId, period_id: activePeriod.period_id },
              select: { attendance_percentage: true }
            }
          }
        }
      }
    });

    // 6. Format and serialize data
    const students = enrollments.map(e => ({
      id: e.student.student_id,
      name: `${e.student.first_name} ${e.student.last_name}`,
      rollNumber: e.student.university_roll_number,
      profileImage: e.student.user?.profile_image_url,
      batchName: e.student.batch?.batch_name,
      programName: e.student.program?.program_name,
      attendancePercentage: e.student.attendance_summaries[0]?.attendance_percentage 
        ? parseFloat(e.student.attendance_summaries[0].attendance_percentage.toString()) 
        : 0
    }));

    return new Response(safeJson({
      success: true,
      data: {
        subjectId: subjectId,
        sectionId: sectionId,
        periodName: activePeriod.name,
        totalStudents: students.length,
        students
      }
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: any) {
    console.error("Error in class-enrollments:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error", details: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
}
