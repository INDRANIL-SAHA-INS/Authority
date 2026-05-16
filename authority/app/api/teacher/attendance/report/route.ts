import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { z } from "zod";

/**
 * Zod Schema specific to this Attendance Report API for Teachers.
 * It validates that student_id and subject_id are numeric strings and
 * that month/year are valid date components.
 */
const attendanceQuerySchema = z.object({
  student_id: z.string().min(1, "student_id is required").regex(/^\d+$/, "Invalid student_id format"),
  subject_id: z.string().min(1, "subject_id is required").regex(/^\d+$/, "Invalid subject_id format"),
  month: z.preprocess(
    (val) => (val ? parseInt(val as string, 10) : undefined),
    z.number().min(1).max(12).optional()
  ),
  year: z.preprocess(
    (val) => (val ? parseInt(val as string, 10) : undefined),
    z.number().min(2000).max(2100).optional()
  ),
});

/**
 * Serializes BigInt to String for JSON safety.
 */
const safeJson = (data: unknown) =>
  JSON.stringify(data, (_, v) => (typeof v === "bigint" ? v.toString() : v));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, ngrok-skip-browser-warning",
};

export async function GET(req: NextRequest) {
  try {
    // 1. Authentication & Role Check
    const user = await getCurrentUser(req);
    if (!user || user.role !== "TEACHER") {
      return NextResponse.json(
        { success: false, message: "Unauthorized: Access restricted to teachers" },
        { status: 401, headers: corsHeaders }
      );
    }

    // 2. Extract & Validate Parameters using Zod
    const url = new URL(req.url);
    const params = Object.fromEntries(url.searchParams.entries());
    const validation = attendanceQuerySchema.safeParse(params);

    if (!validation.success) {
      return NextResponse.json({
        success: false,
        message: "Invalid request parameters",
        errors: validation.error.format()
      }, { status: 400, headers: corsHeaders });
    }

    const { student_id, subject_id, month: monthVal, year: yearVal } = validation.data;
    const studentId = BigInt(student_id);
    const subjectId = BigInt(subject_id);
    const month = monthVal || new Date().getMonth() + 1;
    const year = yearVal || new Date().getFullYear();

    // 3. Fetch Active Period
    const activePeriod = await prisma.academicPeriod.findFirst({
      where: { is_active: true },
      select: { period_id: true }
    });

    if (!activePeriod) {
      return NextResponse.json(
        { success: false, message: "No active academic period found" },
        { status: 404, headers: corsHeaders }
      );
    }

    // 4. Database Queries (Parallel Fetch)
    const [summary, records] = await Promise.all([
      // Fetch Overall Summary for the Subject
      prisma.attendanceSummary.findFirst({
        where: {
          student_id: studentId,
          subject_id: subjectId,
          period_id: activePeriod.period_id
        }
      }),
      // Fetch Detailed Records for the Specific Month
      prisma.attendanceRecord.findMany({
        where: {
          student_id: studentId,
          session: {
            subject_id: subjectId,
            session_date: {
              gte: new Date(Date.UTC(year, month - 1, 1)),
              lte: new Date(Date.UTC(year, month, 0, 23, 59, 59))
            }
          }
        },
        include: {
          session: {
            include: {
              timetable: {
                include: {
                  classroom: true,
                  time_slot: true
                }
              }
            }
          }
        },
        orderBy: {
          session: {
            session_date: "asc"
          }
        }
      })
    ]);

    // 5. Data Transformation
    interface CalendarEntry {
      status: "present" | "absent";
      sessionDetail: {
        timeLabel: string;
        room: string;
        duration: string;
      };
    }

    const calendar: Record<string, CalendarEntry[]> = {};

    records.forEach((rec) => {
      const sessionDate = rec.session.session_date;
      if (!sessionDate) return;

      const dateKey = sessionDate.toISOString().split("T")[0];

      const startTime = rec.session.timetable?.time_slot?.start_time;
      let timeLabel = "N/A";
      if (startTime) {
        const h = startTime.getUTCHours();
        const m = startTime.getUTCMinutes();
        const ampm = h >= 12 ? "PM" : "AM";
        const h12 = h % 12 || 12;
        timeLabel = `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
      }

      if (!calendar[dateKey]) {
        calendar[dateKey] = [];
      }

      calendar[dateKey].push({
        status: rec.attendance_status?.toLowerCase().includes("present") ? "present" : "absent",
        sessionDetail: {
          timeLabel,
          room: rec.session.timetable?.classroom?.room_number || "TBD",
          duration: rec.session.timetable?.time_slot?.duration_minutes 
            ? `${rec.session.timetable.time_slot.duration_minutes} mins` 
            : "1 hr"
        }
      });
    });

    // 6. Construct Final Response (Exactly like student attendance report)
    const responsePayload = {
      success: true,
      data: {
        stats: {
          total: summary?.total_classes || 0,
          present: summary?.classes_attended || 0,
          absent: summary?.classes_missed || 0,
          percentage: summary?.attendance_percentage || 0,
          safeBunks: summary?.safe_bunks || 0
        },
        calendar
      }
    };

    return new Response(safeJson(responsePayload), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("[Teacher Attendance Report API Error]:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}
