import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/teacher/attendance/student-report?student_id=...&subject_id=...&month=...&year=...
 * Fetches detailed attendance report for a specific student, curated for a calendar UI.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const studentIdStr = searchParams.get("student_id");
    const subjectIdStr = searchParams.get("subject_id");
    
    if (!studentIdStr || !subjectIdStr) {
      return NextResponse.json(
        { success: false, message: "student_id and subject_id are required" },
        { status: 400 }
      );
    }

    const studentId = BigInt(studentIdStr);
    const subjectId = BigInt(subjectIdStr);

    // 1. Get the current active period
    const activePeriod = await prisma.academicPeriod.findFirst({
      where: { is_active: true }
    });

    if (!activePeriod) {
      return NextResponse.json({ success: false, message: "Active period not found" }, { status: 404 });
    }

    // 2. Fetch Summary Statistics
    const summary = await prisma.attendanceSummary.findUnique({
      where: {
        student_id_subject_id_period_id: {
          student_id: studentId,
          subject_id: subjectId,
          period_id: activePeriod.period_id
        }
      }
    });

    // 3. Fetch Student Identity
    const student = await prisma.student.findUnique({
      where: { student_id: studentId },
      select: { first_name: true, last_name: true, university_roll_number: true }
    });

    // 4. Monthly Calendar Logic
    const now = new Date();
    // month is 0-indexed (0 = Jan, 9 = Oct)
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
            lte: endDate
          }
        }
      },
      include: {
        session: {
          include: {
            classroom: {
              select: { room_number: true, building_name: true }
            },
            timetable: {
              include: {
                time_slot: true
              }
            }
          }
        }
      },
      orderBy: {
        session: {
          session_date: 'asc'
        }
      }
    });

    // 5. Curate the response into a Date Map for the UI
    // Dictionary key: "YYYY-MM-DD"
    const calendarMap: Record<string, any> = {};

    records.forEach(r => {
      if (r.session.session_date) {
        // We use the date part as the key
        const dateKey = r.session.session_date.toISOString().split('T')[0];
        calendarMap[dateKey] = {
          attendanceId: r.attendance_id.toString(),
          status: r.attendance_status, // "PRESENT", "ABSENT", "LEAVE"
          sessionDetail: {
            startTime: r.session.timetable.time_slot.start_time,
            endTime: r.session.timetable.time_slot.end_time,
            slotName: r.session.timetable.time_slot.slot_name,
            room: r.session.classroom.room_number,
            building: r.session.classroom.building_name
          }
        };
      }
    });

    return NextResponse.json(serializeBigInt({
      success: true,
      data: {
        studentInfo: {
          name: `${student?.first_name} ${student?.last_name}`,
          rollNumber: student?.university_roll_number
        },
        stats: {
          overallPercentage: summary?.attendance_percentage || 0,
          totalClasses: summary?.total_classes || 0,
          classesAttended: summary?.classes_attended || 0,
          classesMissed: summary?.classes_missed || 0,
        },
        // The frontend can now do: if (calendar["2023-10-02"]) { ... }
        calendar: calendarMap
      }
    }));

  } catch (error) {
    console.error("Error in student-report:", error);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}

/**
 * Helper to convert BigInt values for JSON serialization
 */
function serializeBigInt(obj: unknown): unknown {
  if (obj === null || typeof obj !== "object") {
    return typeof obj === "bigint" ? obj.toString() : obj;
  }
  if (obj instanceof Date) return obj.toISOString();
  if (Array.isArray(obj)) return obj.map(serializeBigInt);
  
  const result: Record<string, unknown> = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      result[key] = serializeBigInt((obj as Record<string, unknown>)[key]);
    }
  }
  return result;
}
