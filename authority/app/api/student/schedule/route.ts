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

    // 1. Fetch active period first to use in other queries
    const activePeriod = await prisma.academicPeriod.findFirst({
      where: { is_active: true },
      select: { period_id: true, name: true, academic_year: true, term_type: true }
    });

    if (!activePeriod) {
      return NextResponse.json(
        { success: false, message: "No active academic period found" },
        { status: 404, headers: corsHeaders }
      );
    }

    // 2. Fetch data in parallel
    const [studentProfile, enrollmentsData, attendanceSummaries, teacherAssignments] = await Promise.all([
      prisma.student.findUnique({
        where: { student_id: studentId },
        include: {
          user: true,
          program: true,
          section: {
            include: { classroom: true }
          }
        }
      }),
      prisma.subjectEnrollment.findMany({
        where: {
          student_id: studentId,
          period_id: activePeriod.period_id,
          status: "ACTIVE"
        },
        include: {
          subject: true
        }
      }),
      prisma.attendanceSummary.findMany({
        where: {
          student_id: studentId,
          period_id: activePeriod.period_id
        }
      }),
      prisma.teacherSubjectAssignment.findMany({
        where: {
          period_id: activePeriod.period_id,
          assignment_status: "ACTIVE"
        },
        include: {
          teacher: true,
          subject: true
        }
      })
    ]);

    if (!studentProfile) {
      return NextResponse.json(
        { success: false, message: "Student profile not found" },
        { status: 404, headers: corsHeaders }
      );
    }

    // Fetch timetable for the student's section in the active period
    // Using section_id only (consistent with dashboard route) — subject_id filter is NOT used
    // because SubjectEnrollment records may be incomplete for all timetabled subjects.
    const timetableRows = await prisma.timetable.findMany({
      where: {
        period_id: activePeriod.period_id,
        section_id: studentProfile.section_id,
        timetable_status: "ACTIVE"   // Only show active (non-cancelled) timetable entries
      },
      include: {
        subject: true,
        classroom: true,
        time_slot: true
      },
      orderBy: { time_slot: { start_time: "asc" } }
    });

    // Filter teacher assignments for the student's section
    const sectionTeacherAssignments = teacherAssignments.filter(
      ta => ta.section_id === studentProfile.section_id
    );

    // 2.5 Find current semester number for this batch and period
    const batchSem = await prisma.batchSemester.findFirst({
      where: {
        batch_id: studentProfile.batch_id,
        period_id: activePeriod.period_id
      }
    });
    const currentSemester = batchSem?.semester_number || 0;

    // 3. Process Enrollments with Attendance and Teachers
    let totalCredits = 0;
    const processedEnrollments = enrollmentsData.map((e) => {
      totalCredits += e.subject.credits || 0;

      const attendance = attendanceSummaries.find(a => a.subject_id === e.subject_id);
      const assignment = sectionTeacherAssignments.find(ta => ta.subject_id === e.subject_id);

      return {
        enrollmentId: e.enrollment_id.toString(),
        subject: {
          subject_id: e.subject.subject_id.toString(),
          subject_code: e.subject.subject_code,
          subject_name: e.subject.subject_name,
          subject_type: e.subject.subject_type?.toUpperCase().includes("LAB") ? "Lab" : "Theory",
          credits: e.subject.credits
        },
        section: {
          section_id: studentProfile.section.section_id.toString(),
          section_name: studentProfile.section.section_name,
          classroom: {
            room_number: studentProfile.section.classroom?.room_number || "N/A",
            building_name: studentProfile.section.classroom?.building_name || "N/A"
          }
        },
        attendancePercentage: attendance ? Math.round(attendance.attendance_percentage || 0) : 0,
        safeToMiss: attendance?.safe_bunks || 0,
        classesMissed: attendance?.classes_missed || 0,
        teacher: {
          name: assignment ? `${assignment.teacher.first_name} ${assignment.teacher.last_name}` : "Not Assigned"
        }
      };
    });

    // 4. Process Timetable
    const weeklySchedule: Record<string, any[]> = {
      Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [], Saturday: [], Sunday: []
    };

    timetableRows.forEach((row) => {
      if (weeklySchedule[row.day_of_week]) {
        weeklySchedule[row.day_of_week].push({
          subjectName: row.subject.subject_name,
          sectionName: studentProfile.section.section_name,
          room: row.classroom.room_number,
          startTime: (() => {
            if (!row.time_slot.start_time) return "N/A";
            const date = row.time_slot.start_time;
            const h = date.getUTCHours().toString().padStart(2, '0');
            const m = date.getUTCMinutes().toString().padStart(2, '0');
            const s = date.getUTCSeconds().toString().padStart(2, '0');
            return `${h}:${m}:${s}`;
          })()
        });
      }
    });

    // 5. Final Response
    return new Response(
      safeJson({
        success: true,
        data: {
          student: {
            id: studentId.toString(),
            name: `${studentProfile.first_name} ${studentProfile.last_name}`,
            usn: studentProfile.university_roll_number,
            email: studentProfile.user?.email || "N/A",
            course: studentProfile.program?.program_name || "N/A",
            semester: currentSemester,
            academicYear: activePeriod.academic_year,
            termType: activePeriod.term_type,
            residenceStatus: "Dayscholar", // Default as requested
            avatar: studentProfile.user?.profile_image_url || null
          },
          studentId: studentId.toString(),
          totalCredits: totalCredits,
          enrolledSubjects: processedEnrollments,
          weeklySchedule: weeklySchedule
        }
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  } catch (error) {
    console.error("[Student Schedule API Error]:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500, headers: corsHeaders }
    );
  }
}
