import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/teacher/schedule?user_id=...
 * Fetches the active subject assignments and the weekly timetable for a teacher.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    
    // --- AUTHENTICATION / AUTHORIZATION ---
    // Currently using query parameter for development.
    // TODO: Add JWT Token verification here in the future
    const userIdStr = searchParams.get("user_id");

    if (!userIdStr) {
      return NextResponse.json(
        { success: false, message: "user_id is required" },
        { status: 400 }
      );
    }

    const userId = BigInt(userIdStr);

    // 1. Fetch Teacher ID from User ID
    // Fast retrieval using unique index on user_id
    const teacher = await prisma.teacher.findUnique({
      where: { user_id: userId },
      select: { teacher_id: true }
    });

    if (!teacher) {
      return NextResponse.json(
        { success: false, message: "Teacher record not found" },
        { status: 404 }
      );
    }

    const teacherId = teacher.teacher_id;

    // 2. Fetch Active Subject Assignments
    // Fetches what subjects the teacher is officially assigned to teach
    const assignments = await prisma.teacherSubjectAssignment.findMany({
      where: {
        teacher_id: teacherId,
        assignment_status: "ACTIVE"
      },
      include: {
        subject: {
          select: {
            subject_id: true,
            subject_code: true,
            subject_name: true,
            subject_type: true,
            credits: true
          }
        },
        batch: {
          select: {
            batch_id: true,
            batch_name: true
          }
        },
        section: {
          select: {
            section_id: true,
            section_name: true
          }
        }
      }
    });

    // 3. Fetch Full Timetable (Mon-Fri)
    // Detailed schedule with time slots and classrooms
    const timetableRows = await prisma.timetable.findMany({
      where: {
        teacher_id: teacherId,
        period: {
          is_active: true // Only fetch for the current active academic period
        }
      },
      include: {
        subject: {
          select: {
            subject_code: true,
            subject_name: true
          }
        },
        section: {
          select: {
            section_name: true
          }
        },
        classroom: {
          select: {
            room_number: true,
            building_name: true
          }
        },
        time_slot: true
      },
      orderBy: [
        { day_of_week: "asc" }, // Sorting will be handled in JS grouping
        { time_slot: { start_time: "asc" } }
      ]
    });

    // 4. Arrange Timetable Day-wise
    interface TimetableEntry {
      id: string;
      subjectCode: string | null;
      subjectName: string | null;
      sectionName: string | null;
      room: string | null;
      building: string | null;
      slotName: string;
      startTime: Date | null | string;
      endTime: Date | null | string;
    }

    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
    const groupedTimetable: Record<string, TimetableEntry[]> = {};
    
    days.forEach(day => {
      groupedTimetable[day] = timetableRows
        .filter(row => row.day_of_week === day)
        .map(row => ({
          id: row.timetable_id.toString(),
          subjectCode: row.subject.subject_code,
          subjectName: row.subject.subject_name,
          sectionName: row.section.section_name,
          room: row.classroom.room_number,
          building: row.classroom.building_name,
          slotName: row.time_slot.slot_name,
          startTime: row.time_slot.start_time,
          endTime: row.time_slot.end_time
        }));
    });

    // 5. Serialize BigInts to Strings for the final response
    const serializedAssignments = assignments.map(a => ({
      assignmentId: a.assignment_id.toString(),
      subject: a.subject,
      batch: a.batch,
      section: a.section,
      role: a.assignment_role,
      hoursPerWeek: a.assigned_hours_per_week
    }));

    return NextResponse.json(serializeBigInt({
      success: true,
      data: {
        teacherId: teacherId.toString(),
        totalActiveAssignments: serializedAssignments.length,
        assignments: serializedAssignments,
        weeklySchedule: groupedTimetable
      }
    }));

    } catch (error) {
    console.error("Error fetching teacher schedule:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Recursive helper to convert BigInt values to strings
 */
function serializeBigInt(obj: unknown): unknown {
  // Handle Null and Non-objects
  if (obj === null || typeof obj !== "object") {
    return typeof obj === "bigint" ? obj.toString() : obj;
  }

  // Handle Date objects specifically (Prisma's DateTime/@db.Time)
  if (obj instanceof Date) {
    return obj.toISOString();
  }

  // Handle Arrays
  if (Array.isArray(obj)) {
    return obj.map(serializeBigInt);
  }

  // Handle Objects
  const result: Record<string, unknown> = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      result[key] = serializeBigInt((obj as Record<string, unknown>)[key]);
    }
  }
  return result;
}
