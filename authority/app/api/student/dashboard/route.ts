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
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }

    const studentId = BigInt(user.profileId);

    // 1. Time Context (IST)
    const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istTime = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + istOffset);
    const todayName = DAYS[istTime.getDay()];

    // 2. Parallel Fetch (Full Data)
    const [student, timetableRows, attendanceSummaries] = await Promise.all([
      prisma.student.findUnique({
        where: { student_id: studentId },
        include: { 
          program: true,
          user: { select: { email: true, profile_image_url: true } } 
        }
      }),
      prisma.timetable.findMany({
        where: {
          day_of_week: todayName,
          timetable_status: "ACTIVE",
          period: { is_active: true },
          OR: [
            { batch: { students: { some: { student_id: studentId } } } },
            { section: { students: { some: { student_id: studentId } } } }
          ]
        },
        include: { 
          subject: true, 
          classroom: true, 
          time_slot: true, 
          section: true, 
          batch: true,
          teacher: { 
            select: { 
              first_name: true, 
              last_name: true, 
              user: { select: { profile_image_url: true } } 
            } 
          }
        },
        orderBy: { time_slot: { start_time: "asc" } }
      }),
      prisma.attendanceSummary.findMany({
        where: { student_id: studentId, period: { is_active: true } }
      })
    ]);

    if (!student) return NextResponse.json({ success: false, message: "Not found" }, { status: 404, headers: corsHeaders });

    // 3. Attendance Mapping
    const getStats = (conducted: number, attended: number) => ({
      percentage: conducted > 0 ? Math.round((attended / conducted) * 100) : 0,
      safeToMiss: conducted > 0 ? Math.max(0, Math.floor((attended / 0.8) - conducted)) : 0
    });

    const subjectStatsMap: Record<string, any> = {};
    let grandConducted = 0, grandAttended = 0, grandMissed = 0;

    attendanceSummaries.forEach(s => {
      const c = s.total_classes ?? 0, a = s.classes_attended ?? 0, m = s.classes_missed ?? 0;
      grandConducted += c; grandAttended += a; grandMissed += m;
      subjectStatsMap[s.subject_id.toString()] = { ...getStats(c, a), missed: m };
    });

    // 4. Map All Classes for Today (Corrected Timezone Logic)
    const todaySchedule = timetableRows.map(row => {
      if (!row.time_slot?.start_time || !row.time_slot?.end_time) return null;

      const createISTDate = (timeDate: Date) => {
        const d = new Date(now);
        d.setUTCHours(timeDate.getUTCHours(), timeDate.getUTCMinutes(), 0, 0);
        return new Date(d.getTime() - istOffset);
      };

      const startDT = createISTDate(row.time_slot.start_time);
      const endDT = createISTDate(row.time_slot.end_time);

      const stats = subjectStatsMap[row.subject_id.toString()] || { percentage: 0, safeToMiss: 0, missed: 0 };
      
      return {
        id: row.timetable_id.toString(),
        tag: row.subject?.subject_type?.toUpperCase().includes("LAB") ? "Lab" : "Lec",
        courseName: row.subject?.subject_name || "Unknown Course",
        instructor: {
          name: row.teacher ? `${row.teacher.first_name} ${row.teacher.last_name}` : "TBD",
          image: row.teacher?.user?.profile_image_url || null
        },
        attendance: stats,
        meta: {
          credits: row.subject?.credits || 0,
          type: row.subject?.subject_type || "Theory",
          batch: row.batch?.batch_name || "General",
          section: row.section?.section_name || "Common"
        },
        location: {
          room: row.classroom?.room_number || "TBD",
          building: row.classroom?.building_name || "N/A"
        },
        timings: {
          display: row.time_slot.slot_name,
          startTime: startDT.toISOString(),
          endTime: endDT.toISOString(),
          startLabel: startDT.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }),
          endLabel: endDT.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' })
        }
      };
    }).filter(Boolean);

    // 5. Final Optimized Response
    return new Response(safeJson({
      success: true,
      data: {
        serverTime: now.toISOString(),
        student: {
          name: `${student.first_name} ${student.last_name || ""}`.trim(),
          email: student.user?.email || "N/A",
          avatar: student.user?.profile_image_url || null,
          institution: "RV University",
          program: student.program?.program_name || "N/A",
          usn: student.university_roll_number || "N/A",
          residenceStatus: "Day Scholar"
        },
        overallAttendance: {
          ...getStats(grandConducted, grandAttended),
          missed: grandMissed
        },
        todaySchedule
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("[Student Dashboard Error]:", error);
    return NextResponse.json({ success: false, message: "Server Error" }, { status: 500, headers: corsHeaders });
  }
}
