import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

// Gap 6 Fixed: CORS headers for mobile compatibility
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, ngrok-skip-browser-warning",
};

// Gap 4 Fixed: Shared safeJson instead of local serializeBigInt
const safeJson = (obj: any) =>
  JSON.stringify(obj, (_, v) => (typeof v === "bigint" ? v.toString() : v));

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

/**
 * GET /api/teacher/attendance/student-report?student_id=...&subject_id=...&month=...&year=...
 * Fetches detailed attendance report for a specific student, curated for a calendar UI.
 *
 * Authentication: Requires a valid TEACHER JWT token.
 * Authorization:  Teacher must be assigned to the requested subject_id.
 */
export async function GET(req: NextRequest) {
  try {
    // Gap 1 Fixed: JWT Authentication
    const currentUser = await getCurrentUser(req);
    if (!currentUser) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401, headers: corsHeaders }
      );
    }

    // Gap 2 Fixed (part 1): Role check — must be a TEACHER
    if (currentUser.role !== "TEACHER") {
      return NextResponse.json(
        { success: false, message: "Forbidden: Teacher access only" },
        { status: 403, headers: corsHeaders }
      );
    }

    const teacherId = BigInt(currentUser.profileId);

    const { searchParams } = new URL(req.url);
    const studentIdStr = searchParams.get("student_id");
    const subjectIdStr = searchParams.get("subject_id");

    if (!studentIdStr || !subjectIdStr) {
      return NextResponse.json(
        { success: false, message: "student_id and subject_id are required" },
        { status: 400, headers: corsHeaders }
      );
    }

    const studentId = BigInt(studentIdStr);
    const subjectId = BigInt(subjectIdStr);

    // 1. Get the current active period
    const activePeriod = await prisma.academicPeriod.findFirst({
      where: { is_active: true },
    });

    if (!activePeriod) {
      return NextResponse.json(
        { success: false, message: "Active period not found" },
        { status: 404, headers: corsHeaders }
      );
    }

    // Gap 2 Fixed (part 2): Authorization — verify teacher is assigned to this subject
    const assignment = await prisma.teacherSubjectAssignment.findFirst({
      where: {
        teacher_id: teacherId,
        subject_id: subjectId,
        period_id: activePeriod.period_id,
        assignment_status: "ACTIVE",
      },
    });

    if (!assignment) {
      return NextResponse.json(
        { success: false, message: "Forbidden: You are not assigned to this subject" },
        { status: 403, headers: corsHeaders }
      );
    }

    // 2. Fetch Summary Statistics
    const summary = await prisma.attendanceSummary.findUnique({
      where: {
        student_id_subject_id_period_id: {
          student_id: studentId,
          subject_id: subjectId,
          period_id: activePeriod.period_id,
        },
      },
    });

    // Gap 5 Fixed: Null-guard for student not found → clean 404
    const student = await prisma.student.findUnique({
      where: { student_id: studentId },
      select: { first_name: true, last_name: true, university_roll_number: true },
    });

    if (!student) {
      return NextResponse.json(
        { success: false, message: "Student not found" },
        { status: 404, headers: corsHeaders }
      );
    }

    // 3. Monthly Calendar Logic
    const now = new Date();
    const month = parseInt(searchParams.get("month") || now.getMonth().toString());
    const year = parseInt(searchParams.get("year") || now.getFullYear().toString());

    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0, 23, 59, 59);

    const records = await prisma.attendanceRecord.findMany({
      where: {
        student_id: studentId,
        session: {
          subject_id: subjectId,
          session_date: {
            gte: startDate,
            lte: endDate,
          },
        },
      },
      include: {
        session: {
          include: {
            classroom: {
              select: { room_number: true, building_name: true },
            },
            timetable: {
              include: {
                time_slot: true,
              },
            },
          },
        },
      },
      orderBy: {
        session: {
          session_date: "asc",
        },
      },
    });

    // 4. Build the calendar map — one record per day (one subject = one slot/day, no overwrite risk)
    const calendarMap: Record<string, any> = {};

    records.forEach((r) => {
      if (r.session.session_date) {
        const dateKey = r.session.session_date.toISOString().split("T")[0];
        calendarMap[dateKey] = {
          attendanceId: r.attendance_id.toString(),
          status: r.attendance_status, // "PRESENT", "ABSENT", "LEAVE"
          sessionDetail: {
            startTime: r.session.timetable.time_slot.start_time,
            endTime: r.session.timetable.time_slot.end_time,
            slotName: r.session.timetable.time_slot.slot_name,
            room: r.session.classroom.room_number,
            building: r.session.classroom.building_name,
          },
        };
      }
    });

    return new NextResponse(
      safeJson({
        success: true,
        data: {
          studentInfo: {
            name: `${student.first_name} ${student.last_name}`,
            rollNumber: student.university_roll_number,
          },
          stats: {
            overallPercentage: summary?.attendance_percentage || 0,
            totalClasses: summary?.total_classes || 0,
            classesAttended: summary?.classes_attended || 0,
            classesMissed: summary?.classes_missed || 0,
          },
          calendar: calendarMap,
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error) {
    console.error("Error in student-report:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500, headers: corsHeaders }
    );
  }
}
