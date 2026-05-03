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
    if (!user || user.role !== "TEACHER") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }

    const teacherId = BigInt(user.profileId);

    // 1. Fetch data in parallel
    const [teacherProfile, assignmentsData, timetableRows] = await Promise.all([
      prisma.teacher.findUnique({
        where: { teacher_id: teacherId },
        select: { user: { select: { is_active: true } } }
      }),
      prisma.teacherSubjectAssignment.findMany({
        where: { teacher_id: teacherId, assignment_status: "ACTIVE" },
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
              section_name: true,
              classroom: {
                select: {
                  room_number: true,
                  building_name: true
                }
              }
            }
          }
        }
      }),
      prisma.timetable.findMany({
        where: {
          teacher_id: teacherId,
          period: { is_active: true }
        },
        include: {
          subject: {
            select: {
              subject_id: true,
              subject_code: true,
              subject_name: true
            }
          },
          section: {
            select: {
              section_id: true,
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
        orderBy: { time_slot: { start_time: "asc" } }
      })
    ]);

    if (!teacherProfile) return NextResponse.json({ success: false, message: "Not found" }, { status: 404, headers: corsHeaders });
    if (teacherProfile.user && !teacherProfile.user.is_active) {
      return NextResponse.json({ success: false, message: "Deactivated" }, { status: 403, headers: corsHeaders });
    }

    // 2. Process Timetable (Exact same format as original)
    const weeklySchedule: Record<string, any[]> = { Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [] };
    
    timetableRows.forEach(row => {
      if (weeklySchedule[row.day_of_week]) {
        weeklySchedule[row.day_of_week].push({
          id: row.timetable_id.toString(),
          subjectId: row.subject.subject_id.toString(),
          subjectCode: row.subject.subject_code,
          subjectName: row.subject.subject_name,
          sectionId: row.section.section_id.toString(),
          sectionName: row.section.section_name,
          room: row.classroom.room_number,
          building: row.classroom.building_name,
          slotName: row.time_slot.slot_name,
          startTime: row.time_slot.start_time,
          endTime: row.time_slot.end_time
        });
      }
    });

    // 3. Process Assignments (Exact same format as original)
    const assignments = assignmentsData.map(a => ({
      assignmentId: a.assignment_id.toString(),
      subject: a.subject,
      batch: a.batch,
      section: a.section,
      roomNumber: a.section.classroom?.room_number || "N/A",
      buildingName: a.section.classroom?.building_name || "N/A",
      role: a.assignment_role,
      hoursPerWeek: a.assigned_hours_per_week
    }));

    return new Response(safeJson({
      success: true,
      data: {
        teacherId: teacherId.toString(),
        totalActiveAssignments: assignments.length,
        assignments: assignments,
        weeklySchedule: weeklySchedule
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("[Schedule API Error]:", error);
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500, headers: corsHeaders });
  }
}
