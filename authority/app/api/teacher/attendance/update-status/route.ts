import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * PATCH /api/teacher/attendance/update-status
 * Body: { "attendance_id": "...", "new_status": "PRESENT" | "ABSENT" | "LEAVE" }
 * Updates a specific attendance record and automatically recalculates the student's summary percentage.
 */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { attendance_id, new_status } = body;

    if (!attendance_id || !new_status) {
      return NextResponse.json(
        { success: false, message: "attendance_id and new_status are required" },
        { status: 400 }
      );
    }

    const attendanceId = BigInt(attendance_id);

    // 1. Update the record
    // We include session and student to get the keys for summary update
    const updatedRecord = await prisma.attendanceRecord.update({
      where: { attendance_id: attendanceId },
      data: { 
        attendance_status: new_status,
        updated_at: new Date()
      },
      include: {
        session: {
          select: {
            subject_id: true,
            timetable: {
               select: { period_id: true }
            }
          }
        },
        student: {
          select: { student_id: true }
        }
      }
    });

    const studentId = updatedRecord.student.student_id;
    const subjectId = updatedRecord.session.subject_id;
    const periodId = updatedRecord.session.timetable.period_id;

    // 2. Recalculate Attendance Summary
    // We fetch all records for this student-subject-period to ensure accuracy
    const allRecords = await prisma.attendanceRecord.findMany({
      where: {
        student_id: studentId,
        session: {
          subject_id: subjectId,
          timetable: {
            period_id: periodId
          }
        }
      },
      select: { attendance_status: true }
    });

    const totalClasses = allRecords.length;
    const classesAttended = allRecords.filter(r => r.attendance_status === "PRESENT").length;
    const classesMissed = allRecords.filter(r => r.attendance_status === "ABSENT").length;
    const attendancePercentage = totalClasses > 0 ? (classesAttended / totalClasses) * 100 : 0;

    // 3. Update the summary table
    await prisma.attendanceSummary.upsert({
      where: {
        student_id_subject_id_period_id: {
          student_id: studentId,
          subject_id: subjectId,
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
        student_id: studentId,
        subject_id: subjectId,
        period_id: periodId,
        total_classes: totalClasses,
        classes_attended: classesAttended,
        classes_missed: classesMissed,
        attendance_percentage: attendancePercentage
      }
    });

    return NextResponse.json({
      success: true,
      message: "Attendance status updated and summary recalculated",
      data: {
        newStatus: new_status,
        newPercentage: attendancePercentage.toFixed(2) + "%"
      }
    });

  } catch (error) {
    console.error("Error in update-status:", error);
    return NextResponse.json(
      { success: false, message: "Failed to update attendance" },
      { status: 500 }
    );
  }
}
