import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

// Helper to safely serialize BigInt values in JSON
const safeJson = (data: unknown) =>
  JSON.stringify(data, (_, value) =>
    typeof value === "bigint" ? value.toString() : value
  );

// Standardized CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, ngrok-skip-browser-warning",
};

export async function GET(request: NextRequest) {
  try {
    // 1. Get the authenticated user and their teacher_id automatically
    const user = await getCurrentUser(request);

    // 2. Security Check: Ensure user is logged in and is a TEACHER
    if (!user || user.role !== "TEACHER") {
      return NextResponse.json(
        { error: "Unauthorized or not a teacher profile" },
        { status: 401, headers: corsHeaders }
      );
    }

    const teacherId = BigInt(user.profileId);

    // --- Step 2: Determine today's day name (IST Timezone Aware) ---
    const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    
    // Convert current time to IST (UTC+5.5) regardless of server location
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istTime = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + istOffset);
    const todayName = DAYS[istTime.getDay()];

    // --- Step 3: Fetch teacher profile + today's ACTIVE timetable ---
    const teacher = await prisma.teacher.findUnique({
      where: { teacher_id: teacherId },
      include: {
        department: true,
        user: {
          select: {
            profile_image_url: true,
            is_active: true, // Needed for account security check
          }
        },
        timetables: {
          where: {
            day_of_week: todayName,
            timetable_status: "ACTIVE",
            period: { is_active: true },
          },
          include: {
            subject: true,
            batch: true,
            section: true,
            classroom: true,
            time_slot: true,
          },
          orderBy: {
            time_slot: {
              start_time: "asc",
            },
          },
        },
      },
    });

    // --- Step 4: Validation and Security Checks ---
    if (!teacher) {
      return NextResponse.json({ error: "Teacher profile not found" }, { status: 404, headers: corsHeaders });
    }

    // Check if the actual user account is deactivated
    if (teacher.user && !teacher.user.is_active) {
      return NextResponse.json({ error: "Account deactivated" }, { status: 403, headers: corsHeaders });
    }


    const todaySchedule = teacher.timetables.map((slot) => {
      if (!slot.time_slot?.start_time || !slot.time_slot?.end_time) return null;

      // Map the Time from DB onto today's actual date in IST
      const createISTDate = (timeDate: Date) => {
        const d = new Date(now);
        d.setUTCHours(timeDate.getUTCHours(), timeDate.getUTCMinutes(), 0, 0);
        return new Date(d.getTime() - istOffset);
      };

      const startDT = createISTDate(slot.time_slot.start_time);
      const endDT = createISTDate(slot.time_slot.end_time);

      return {
        id: slot.timetable_id, // safeJson handles the BigInt conversion
        subjectName: slot.subject.subject_name ?? null,
        subjectCode: slot.subject.subject_code ?? null,
        type: slot.subject.subject_type ?? null,
        batch: slot.batch.batch_name ?? null,
        section: slot.section.section_name ?? null,
        classStrength: slot.section.section_strength ?? 0,
        room: slot.classroom.room_number ?? null,
        timings: {
          display: slot.time_slot.slot_name ?? null,
          startTime: startDT.toISOString(),
          endTime: endDT.toISOString(),
          startLabel: startDT.toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit', 
            hour12: true, 
            timeZone: 'Asia/Kolkata' 
          }),
          endLabel: endDT.toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit', 
            hour12: true, 
            timeZone: 'Asia/Kolkata' 
          })
        }
      };
    }).filter(Boolean);

    // --- Step 5: Build the clean response payload ---
    const response = {
      profile: {
        fullName: `${teacher.first_name ?? ""} ${teacher.last_name ?? ""}`.trim(),
        department: teacher.department?.department_name ?? null,
        profileImage: teacher.user?.profile_image_url ?? null,
        status: teacher.status ?? "ACTIVE",
      },
      todaySchedule,
      meta: {
        day: todayName,
        totalClassesToday: todaySchedule.length,
      },
    };

    return new Response(safeJson(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[teacher/dashboard] Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500, headers: corsHeaders });
  }
}
