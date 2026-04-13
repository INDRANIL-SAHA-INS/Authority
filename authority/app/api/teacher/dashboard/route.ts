import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Helper to safely serialize BigInt values in JSON
const safeJson = (data: unknown) =>
  JSON.stringify(data, (_, value) =>
    typeof value === "bigint" ? value.toString() : value
  );

export async function GET(request: NextRequest) {
  try {
    // --- Step 1: Extract user_id from query params ---
    // TODO: Replace this with JWT token parsing once auth is implemented
    const userId = request.nextUrl.searchParams.get("user_id");

    if (!userId) {
      return NextResponse.json(
        { error: "user_id query parameter is required" },
        { 
          status: 400,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization, ngrok-skip-browser-warning",
          }
        }
      );
    }

    // --- Step 2: Early role check (lightweight — only hits the users table) ---
    // We verify the user exists and is a TEACHER before doing any heavy joins
    const userRole = await prisma.user.findUnique({
      where: { user_id: BigInt(userId) },
      select: { role: true, is_active: true },
    });

    if (!userRole) {
      return NextResponse.json({ error: "User not found" }, { 
        status: 404,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization, ngrok-skip-browser-warning",
        }
      });
    }

    if (userRole.role !== "TEACHER") {
      return NextResponse.json(
        {
          error: "Access denied",
          message: `This endpoint is for teachers only. Your account role is '${userRole.role}'.`,
        },
        { 
          status: 403,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization, ngrok-skip-browser-warning",
          }
        }
      );
    }

    if (!userRole.is_active) {
      return NextResponse.json(
        { error: "Account inactive", message: "Your account has been deactivated. Please contact admin." },
        { 
          status: 403,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization, ngrok-skip-browser-warning",
          }
        }
      );
    }

    // --- Step 3: Determine today's day name (matches DB format e.g. "Monday") ---
    const DAYS = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];
    const todayName = DAYS[new Date().getDay()];

    // --- Step 3: Fetch teacher profile + today's ACTIVE timetable in one query ---
    const userData = await prisma.user.findUnique({
      where: { user_id: BigInt(userId) },
      include: {
        teacher: {
          include: {
            department: true,
            timetables: {
              where: {
                day_of_week: todayName,
                timetable_status: "ACTIVE",
              },
              include: {
                subject: true,
                batch: true,
                section: true,
                classroom: true,
                time_slot: true,
              },
              orderBy: {
                // Sort classes by start time so frontend gets them in order
                time_slot: {
                  start_time: "asc",
                },
              },
            },
          },
        },
      },
    });

    // --- Step 4: Validate that this user is actually a teacher ---
    if (!userData) {
      return NextResponse.json({ error: "User not found" }, { 
        status: 404,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization, ngrok-skip-browser-warning",
        }
      });
    }

    if (!userData.teacher) {
      return NextResponse.json(
        { error: "No teacher profile linked to this user" },
        { 
          status: 404,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization, ngrok-skip-browser-warning",
          }
        }
      );
    }

    const teacher = userData.teacher;

    // --- Step 5: Build the clean response payload ---
    const response = {
      profile: {
        fullName: `${teacher.first_name ?? ""} ${teacher.last_name ?? ""}`.trim(),
        department: teacher.department.department_name ?? null,
        profileImage: userData.profile_image_url ?? null,
        // The frontend uses startTime/endTime of each class to determine
        // "Live Now" status — no need to compute it here
        status: teacher.status ?? null,
      },
      // Today's classes ordered by time.
      // Frontend determines:
      //   - current time within startTime..endTime  → "Live Now"
      //   - startTime > now                         → "Upcoming"
      //   - endTime < now                           → "Completed"
      todaySchedule: teacher.timetables.map((slot) => ({
        id: slot.timetable_id.toString(),
        subjectName: slot.subject.subject_name ?? null,
        subjectCode: slot.subject.subject_code ?? null,
        type: slot.subject.subject_type ?? null, // "Lecture" | "Lab"
        batch: slot.batch.batch_name ?? null,
        section: slot.section.section_name ?? null,
        classStrength: slot.section.section_strength ?? 0,
        room: slot.classroom.room_number ?? null,
        // Raw times for frontend "Live Now" calculation
        startTime: slot.time_slot.start_time,
        endTime: slot.time_slot.end_time,
        // Human-readable label e.g. "10:00 AM – 11:00 AM"
        timeLabel: slot.time_slot.slot_name ?? null,
      })),
      meta: {
        day: todayName,
        totalClassesToday: teacher.timetables.length,
      },
    };

    return new Response(safeJson(response), {
      status: 200,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, ngrok-skip-browser-warning",
      },
    });
  } catch (error) {
    console.error("[teacher/dashboard] Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { 
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization, ngrok-skip-browser-warning",
        }
      }
    );
  }
}
