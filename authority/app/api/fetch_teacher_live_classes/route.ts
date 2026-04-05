import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const teacherId = searchParams.get("teacher_id");

    if (!teacherId) {
      return NextResponse.json({ error: "Teacher ID is required" }, { status: 400 });
    }

    // 1. Get Today's Day in the format the DB expects (MONDAY, TUESDAY...)
    // Hardcoded for testing session
    const today = "MONDAY";

    console.log(`[DEBUG] Fetching Live Classes for Teacher: ${teacherId}, Day: ${today}`);

    // 2. Fetch the classes for today
    // Optimization: More robust matching while debugging
    const liveClasses = await prisma.timetable.findMany({
      where: {
        teacher_id: BigInt(teacherId),
        day_of_week: {
          equals: today,
          mode: 'insensitive' // Makes "Monday" match "MONDAY"
        },
        // Temporarily commented out to find why results are empty:
        timetable_status: "ACTIVE", 
      },
      include: {
        subject: {
          select: {
            subject_name: true,
            subject_code: true,
          },
        },
        classroom: {
          select: {
            room_number: true,
            building_name: true,
          },
        },
        time_slot: {
          select: {
            slot_name: true,
            start_time: true,
            end_time: true,
          },
        },
        section: {
          select: {
            section_name: true,
            section_strength: true, // Direct field access instead of count
          },
        },
        batch: {
          select: {
            batch_name: true,
          },
        },
      },
      orderBy: {
        time_slot: {
          start_time: "asc", 
        },
      },
    });

    const safeStringify = (obj: unknown) =>
      JSON.stringify(obj, (key, value) => (typeof value === "bigint" ? value.toString() : value));

    return new Response(safeStringify({ 
        success: true, 
        today,
        classes: liveClasses 
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Live Class Fetch Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: errorMessage },
      { status: 500 }
    );
  }
}
