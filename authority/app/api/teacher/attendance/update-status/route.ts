import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

// CORS headers for mobile/cross-origin compatibility
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "PATCH, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, ngrok-skip-browser-warning",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

/**
 * PATCH /api/teacher/attendance/update-status
 * Body: { "attendance_id": "...", "new_status": "PRESENT" | "ABSENT" | "LEAVE" }
 * Updates a specific attendance record and automatically recalculates the student's summary percentage.
 * 
 * Authentication: Requires valid TEACHER JWT.
 * Authorization: Teacher must be assigned to the subject of the record.
 */
async function updateAttendance(req: NextRequest) {
  try {
    // 1. Authentication
    const currentUser = await getCurrentUser(req);
    if (!currentUser) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401, headers: corsHeaders }
      );
    }

    if (currentUser.role !== "TEACHER") {
      return NextResponse.json(
        { success: false, message: "Forbidden: Teacher access only" },
        { status: 403, headers: corsHeaders }
      );
    }

    const teacherId = BigInt(currentUser.profileId);
    const body = await req.json();
    
    // Payload: { date, status, student_id, subject_id }
    const { date, status, student_id, subject_id } = body;

    if (!date || !status || !student_id || !subject_id) {
      return NextResponse.json(
        { success: false, message: "date, status, student_id, and subject_id are required" },
        { status: 200, headers: corsHeaders } // Returning 200 with success: false
      );
    }

    const targetStudentId = BigInt(student_id);
    const targetSubjectId = BigInt(subject_id);
    const sessionDate = new Date(date);

    // 2. Search for the EXISTING Attendance Record
    const record = await prisma.attendanceRecord.findFirst({
      where: {
        student_id: targetStudentId,
        session: {
          subject_id: targetSubjectId,
          session_date: sessionDate
        }
      },
      include: {
        session: {
          include: {
            timetable: {
              select: { period_id: true }
            }
          }
        }
      }
    });

    // 3. SAFE-FAILURE: If no record found, return 200 OK with success: false
    if (!record) {
      return NextResponse.json(
        { 
          success: false, 
          message: `Update failed: No record found for student ${student_id} on ${date}. Attendance must be taken before it can be updated.` 
        },
        { status: 200, headers: corsHeaders }
      );
    }

    const attendanceId = record.attendance_id;
    const periodId = record.session.timetable.period_id;

    // 4. Authorization Check: Is teacher assigned to this subject?
    const assignment = await prisma.teacherSubjectAssignment.findFirst({
      where: {
        teacher_id: teacherId,
        subject_id: targetSubjectId,
        period_id: periodId,
        assignment_status: "ACTIVE"
      }
    });

    if (!assignment) {
      return NextResponse.json(
        { success: false, message: "Forbidden: You are not assigned to this subject" },
        { status: 200, headers: corsHeaders } // Returning 200 with success: false
      );
    }

    // 5. Update the record
    await prisma.attendanceRecord.update({
      where: { attendance_id: attendanceId },
      data: { 
        attendance_status: status,
        updated_at: new Date()
      }
    });

    // 6. Recalculate Attendance Summary
    const allRecords = await prisma.attendanceRecord.findMany({
      where: {
        student_id: targetStudentId,
        session: {
          subject_id: targetSubjectId,
          timetable: { period_id: periodId }
        }
      },
      select: { attendance_status: true }
    });

    const totalClasses = allRecords.length;
    const classesAttended = allRecords.filter(r => r.attendance_status === "PRESENT").length;
    const classesMissed = allRecords.filter(r => r.attendance_status === "ABSENT").length;
    const attendancePercentage = totalClasses > 0 ? (classesAttended / totalClasses) * 100 : 0;

    // 7. Update the summary table
    await prisma.attendanceSummary.upsert({
      where: {
        student_id_subject_id_period_id: {
          student_id: targetStudentId,
          subject_id: targetSubjectId,
          period_id: periodId
        }
      },
      update: {
        total_classes: totalClasses,
        classes_attended: classesAttended,
        classes_missed: classesMissed,
        attendance_percentage: attendancePercentage,
        last_updated: new Date()
      },
      create: {
        student_id: targetStudentId,
        subject_id: targetSubjectId,
        period_id: periodId,
        total_classes: totalClasses,
        classes_attended: classesAttended,
        classes_missed: classesMissed,
        attendance_percentage: attendancePercentage
      }
    });

    return NextResponse.json({
      success: true,
      message: "Attendance status updated successfully",
      data: {
        newStatus: status,
        newPercentage: attendancePercentage.toFixed(2) + "%"
      }
    }, { headers: corsHeaders });

  } catch (error) {
    console.error("Error in update-status:", error);
    return NextResponse.json(
      { success: false, message: "Failed to update attendance" },
      { status: 200, headers: corsHeaders } // Safe failure even for 500 errors
    );
  }
}

export async function POST(req: NextRequest) {
  return updateAttendance(req);
}

export async function PATCH(req: NextRequest) {
  return updateAttendance(req);
}
