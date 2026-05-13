import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

const safeJson = (data: unknown) =>
  JSON.stringify(data, (_, v) => (typeof v === "bigint" ? v.toString() : v));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, ngrok-skip-browser-warning",
};

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user || user.role !== "STUDENT") {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401, headers: corsHeaders }
      );
    }

    const studentId = BigInt(user.profileId);
    const searchParams = req.nextUrl.searchParams;
    const semesterParam = searchParams.get("semester");

    // 1. Get student's batch to map semester number to period_id
    const student = await prisma.student.findUnique({
      where: { student_id: studentId },
      select: { batch_id: true }
    });

    if (!student) {
      return NextResponse.json(
        { success: false, message: "Student not found" },
        { status: 404, headers: corsHeaders }
      );
    }

    if (!semesterParam) {
      return NextResponse.json(
        { success: false, message: "Semester number is required" },
        { status: 400, headers: corsHeaders }
      );
    }

    const semesterNumber = parseInt(semesterParam);

    // 2. Map semester number to period_id for this student's batch
    const batchSem = await prisma.batchSemester.findFirst({
      where: {
        batch_id: student.batch_id,
        semester_number: semesterNumber,
      },
    });

    if (!batchSem) {
      return NextResponse.json(
        { success: false, message: `Data for Semester ${semesterNumber} not found` },
        { status: 404, headers: corsHeaders }
      );
    }

    const targetPeriodId = batchSem.period_id;

    // 3. Fetch enrollments and attendance summaries for the target period
    const [enrollments, attendanceSummaries] = await Promise.all([
      prisma.subjectEnrollment.findMany({
        where: {
          student_id: studentId,
          period_id: targetPeriodId,
          status: "ACTIVE"
        },
        include: {
          subject: true
        }
      }),
      prisma.attendanceSummary.findMany({
        where: {
          student_id: studentId,
          period_id: targetPeriodId
        }
      })
    ]);

    // 4. Map to a clean, lightweight list of subjects
    const subjects = enrollments.map((e) => {
      const attendance = attendanceSummaries.find(a => a.subject_id === e.subject_id);
      return {
        subject_id: e.subject.subject_id.toString(),
        subject_code: e.subject.subject_code,
        subject_name: e.subject.subject_name,
        subject_type: e.subject.subject_type?.toUpperCase().includes("LAB") ? "Lab" : "Theory",
        credits: e.subject.credits,
        attendancePercentage: attendance ? Math.round(attendance.attendance_percentage || 0) : 0,
        safeBunks: attendance ? attendance.safe_bunks : 0,
      };
    });

    return new Response(
      safeJson({
        success: true,
        data: {
          semester: semesterNumber,
          totalSubjects: subjects.length,
          subjects: subjects
        }
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  } catch (error) {
    console.error("[Student Subjects API Error]:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500, headers: corsHeaders }
    );
  }
}
