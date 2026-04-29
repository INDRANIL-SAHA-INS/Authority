import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/teacher/attendance/class-enrollments?subject_id=...&section_id=...
 * Fetches the list of students for a specific subject and section with their attendance stats.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const subjectIdStr = searchParams.get("subject_id");
    const sectionIdStr = searchParams.get("section_id");

    if (!subjectIdStr || !sectionIdStr) {
      return NextResponse.json(
        { success: false, message: "subject_id and section_id are required" },
        { status: 400 }
      );
    }

    const subjectId = BigInt(subjectIdStr);
    const sectionId = BigInt(sectionIdStr);

    // 1. Automatically find the current active academic period
    const activePeriod = await prisma.academicPeriod.findFirst({
      where: { is_active: true }
    });

    if (!activePeriod) {
      return NextResponse.json(
        { success: false, message: "No active academic period found" },
        { status: 404 }
      );
    }

    // 2. Fetch students enrolled in this subject who belong to the specified section
    const enrollments = await prisma.subjectEnrollment.findMany({
      where: {
        subject_id: subjectId,
        period_id: activePeriod.period_id,
        status: "ACTIVE",
        student: {
          section_id: sectionId
        }
      },
      include: {
        student: {
          select: {
            student_id: true,
            university_roll_number: true,
            first_name: true,
            last_name: true,
            user: {
              select: {
                profile_image_url: true
              }
            },
            batch: {
              select: {
                batch_name: true
              }
            },
            program: {
              select: {
                program_name: true
              }
            },
            attendance_summaries: {
              where: {
                subject_id: subjectId,
                period_id: activePeriod.period_id
              },
              select: {
                attendance_percentage: true
              }
            }
          }
        }
      }
    });

    // 3. Format and serialize data for response
    const students = enrollments.map(e => ({
      id: e.student.student_id.toString(),
      name: `${e.student.first_name} ${e.student.last_name}`,
      rollNumber: e.student.university_roll_number,
      profileImage: e.student.user?.profile_image_url,
      batchName: e.student.batch?.batch_name,
      programName: e.student.program?.program_name,
      attendancePercentage: e.student.attendance_summaries[0]?.attendance_percentage 
        ? parseFloat(e.student.attendance_summaries[0].attendance_percentage.toString()) 
        : 0
    }));

    return NextResponse.json(serializeBigInt({
      success: true,
      data: {
        subjectId: subjectId.toString(),
        sectionId: sectionId.toString(),
        periodName: activePeriod.name,
        totalStudents: students.length,
        students
      }
    }));

  } catch (error) {
    console.error("Error in class-enrollments:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
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
