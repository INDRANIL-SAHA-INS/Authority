import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      section_id, 
      subject_id, 
      student_ids, 
      attendance_threshold 
    } = body;

    // 1. Validate Input
    if (!section_id || !subject_id) {
      return NextResponse.json({ error: "Missing section_id or subject_id" }, { status: 400 });
    }

    const sectionId = BigInt(section_id);
    const subjectId = BigInt(subject_id);
    const threshold = attendance_threshold !== undefined ? Number(attendance_threshold) : null;

    // 2. Fetch data from the Summary Table (The Fast Way)
    interface StudentWithAttendance {
      university_roll_number: string | null;
      first_name: string | null;
      last_name: string | null;
      gender: string | null;
      email: string | null;
      guardian: {
        father_name: string | null;
        email: string | null;
      } | null;
      attendance_summaries: {
        attendance_percentage: number | null;
        total_classes: number | null;
        classes_attended: number | null;
      }[];
    }

    let summaryResults: StudentWithAttendance[] = [];

    if (student_ids && Array.isArray(student_ids) && student_ids.length > 0) {
      // Fetch specific students provided in the list
      const studentIdBigInts = student_ids.map((id: string | number) => BigInt(id));
      summaryResults = await prisma.student.findMany({
        where: {
          student_id: { in: studentIdBigInts },
          section_id: sectionId
        },
        include: {
          guardian: true,
          attendance_summaries: { where: { subject_id: subjectId } }
        }
      });
    } else if (threshold !== null) {
      // Find all students in section who are below the threshold
      summaryResults = await prisma.student.findMany({
        where: {
          section_id: sectionId,
          attendance_summaries: {
            some: {
              subject_id: subjectId,
              attendance_percentage: { lte: threshold }
            }
          }
        },
        include: {
          guardian: true,
          attendance_summaries: { where: { subject_id: subjectId } }
        }
      });
    }

    // 3. Check if we need to Fallback (Manual Calculation)
    const summaryCount = await prisma.attendanceSummary.count({
      where: { subject_id: subjectId, student: { section_id: sectionId } }
    });

    if (summaryCount === 0) {
      // No summary records exist yet, so we calculate from scratch
      const totalSessions = await prisma.attendanceSession.count({
        where: { subject_id: subjectId, section_id: sectionId }
      });

      let studentIdsToProcess;
      if (student_ids && Array.isArray(student_ids) && student_ids.length > 0) {
        // Use provided IDs
        studentIdsToProcess = student_ids.map((id: string | number) => BigInt(id));
      } else {
        // Fetch all student IDs in this section
        const allStudentsInClass = await prisma.student.findMany({
          where: { section_id: sectionId },
          select: { student_id: true }
        });
        studentIdsToProcess = allStudentsInClass.map(s => s.student_id);
      }

      // Count "PRESENT" marks for each student
      const presentCounts = await prisma.attendanceRecord.groupBy({
        by: ['student_id'],
        where: {
          student_id: { in: studentIdsToProcess },
          session: { subject_id: subjectId, section_id: sectionId },
          attendance_status: "PRESENT"
        },
        _count: { attendance_id: true }
      });

      // Create a Map for easy lookup [student_id: count]
      const attendanceMap = new Map<string, number>();
      presentCounts.forEach(item => {
        attendanceMap.set(item.student_id.toString(), item._count.attendance_id);
      });

      // Fetch student details to build the response
      const fallbackDetails = await prisma.student.findMany({
        where: { student_id: { in: studentIdsToProcess }, section_id: sectionId },
        include: { guardian: true }
      });

      // Map the results to our final clean format
      const finalStudentList = fallbackDetails.map(student => {
        const attended = attendanceMap.get(student.student_id.toString()) || 0;
        const rawPercentage = totalSessions > 0 ? (attended / totalSessions) * 100 : 0;
        const percentage = parseFloat(rawPercentage.toFixed(2));
        
        return {
          university_roll_number: student.university_roll_number,
          first_name: student.first_name,
          last_name: student.last_name,
          gender: student.gender,
          email: student.email,
          father_name: student.guardian?.father_name || null,
          guardian_email: student.guardian?.email || null,
          attendance_details: {
            subject_id: subjectId.toString(),
            total_sessions: totalSessions,
            attended_sessions: attended,
            attendance_percentage: percentage,
            is_short_attendance: threshold !== null ? percentage <= threshold : null,
            target_threshold: threshold,
            source: "manual_calculation"
          }
        };
      }).filter(student => {
        // If IDs were provided, keep everyone. Otherwise, filter by threshold.
        if (student_ids && student_ids.length > 0) return true;
        return threshold !== null ? student.attendance_details.is_short_attendance : true;
      });

      return NextResponse.json(serializeBigInt({
        success: true,
        count: finalStudentList.length,
        data: finalStudentList,
        source: "manual_fallback"
      }));
    }

    // 4. Build Final Response from Summary Results
    const finalStudentList = summaryResults.map(student => {
      const summary = student.attendance_summaries[0];
      const percentage = summary?.attendance_percentage || 0;
      
      return {
        university_roll_number: student.university_roll_number,
        first_name: student.first_name,
        last_name: student.last_name,
        gender: student.gender,
        email: student.email,
        father_name: student.guardian?.father_name || null,
        guardian_email: student.guardian?.email || null,
        attendance_details: {
          subject_id: subjectId.toString(),
          total_sessions: summary?.total_classes || 0,
          attended_sessions: summary?.classes_attended || 0,
          attendance_percentage: percentage,
          is_short_attendance: threshold !== null ? percentage <= threshold : null,
          target_threshold: threshold,
          source: "attendance_summary"
        }
      };
    });

    return NextResponse.json(serializeBigInt({
      success: true,
      count: finalStudentList.length,
      data: finalStudentList,
      source: "optimized_summary"
    }));

  } catch (error: unknown) {
    console.error("[STUDENT_EMAIL_DATA]", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Utility to handle BigInt serialization
function serializeBigInt(data: unknown) {
  return JSON.parse(
    JSON.stringify(data, (key, value) =>
      typeof value === "bigint" ? value.toString() : value
    )
  );
}
