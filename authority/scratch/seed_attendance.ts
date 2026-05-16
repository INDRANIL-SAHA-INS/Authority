import { prisma } from "../lib/prisma";
import { snowflake } from "../lib/snowflake";

// CONFIGURATION (Provided by User)
const SECTION_ID = BigInt("264579083378102272");
const BATCH_ID = BigInt("264577534782345216");
const PERIOD_ID = BigInt("264556692765675520");
const TIMETABLE_STATUS = "ACTIVE";
const ATTENDANCE_PROBABILITY = 0.88; // 88% average attendance

async function main() {
  console.log("🚀 Starting Attendance Seeding Pipeline...");

  // 1. Fetch Students & Timetable Context
  const students = await prisma.student.findMany({
    where: { section_id: SECTION_ID },
  });
  
  const timetables = await prisma.timetable.findMany({
    where: {
      section_id: SECTION_ID,
      batch_id: BATCH_ID,
      period_id: PERIOD_ID,
      timetable_status: TIMETABLE_STATUS,
    },
    include: { teacher: true, time_slot: true, subject: true }
  });

  if (students.length === 0 || timetables.length === 0) {
    console.error("❌ Error: Missing students or active timetable entries for the provided IDs.");
    return;
  }

  console.log(`📍 Targeting ${students.length} students across ${timetables.length} weekly slots.`);

  // 2. Define Time Range (April 1, 2026 to May 12, 2026)
  const startDate = new Date("2026-04-01");
  const endDate = new Date("2026-05-12");
  const currentDate = new Date(startDate);

  const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  let totalSessionsCreated = 0;
  let totalRecordsCreated = 0;
  const subjectDistribution = new Map<string, number>();

  while (currentDate <= endDate) {
    const dayName = daysOfWeek[currentDate.getDay()];
    const dailySlots = timetables.filter(t => t.day_of_week === dayName);

    if (dailySlots.length > 0) {
      const dateStr = currentDate.toISOString().split('T')[0];
      process.stdout.write(`📅 [${dateStr}] Processing ${dailySlots.length} sessions... `);

      for (const slot of dailySlots) {
        // A. Upsert Attendance Session (Snapshotted Data)
        const teacherName = `${slot.teacher.first_name} ${slot.teacher.last_name}`;
        const subjectName = slot.subject.subject_name || "Unknown Subject";
        
        // Track distribution
        subjectDistribution.set(subjectName, (subjectDistribution.get(subjectName) || 0) + 1);

        // Randomly decide who is present for this specific session
        const sessionPresentSids = students
          .filter(() => Math.random() < ATTENDANCE_PROBABILITY)
          .map(s => s.student_id);

        const session = await prisma.attendanceSession.upsert({
          where: {
            timetable_id_session_date: {
              timetable_id: slot.timetable_id,
              session_date: currentDate,
            }
          },
          update: {
            present_count: sessionPresentSids.length,
            absent_count: students.length - sessionPresentSids.length,
          },
          create: {
            session_id: snowflake.generate(),
            timetable_id: slot.timetable_id,
            teacher_id: slot.teacher_id,
            subject_id: slot.subject_id,
            batch_id: slot.batch_id,
            section_id: slot.section_id,
            classroom_id: slot.classroom_id,
            session_date: currentDate,
            start_time: slot.time_slot.start_time,
            end_time: slot.time_slot.end_time,
            attendance_method: "MANUAL_SEED",
            total_students: students.length,
            present_count: sessionPresentSids.length,
            absent_count: students.length - sessionPresentSids.length,
          }
        });

        totalSessionsCreated++;

        // B. Generate Records for all students in this session
        const records = students.map(student => {
          const isPresent = sessionPresentSids.includes(student.student_id);
          return {
            attendance_id: snowflake.generate(),
            session_id: session.session_id,
            student_id: student.student_id,
            attendance_status: isPresent ? "PRESENT" : "ABSENT",
            detection_confidence: 0.85 + (Math.random() * 0.15), // 0.85 to 1.0
            marked_by: `Teacher: ${teacherName}`,
            remarks: null,
            created_at: new Date(),
            updated_at: new Date(),
          };
        });

        // Bulk insert records for performance
        await prisma.attendanceRecord.createMany({
          data: records,
          skipDuplicates: true,
        });

        totalRecordsCreated += records.length;
      }
      process.stdout.write("Done ✅\n");
    }
    
    // Increment day
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // 3. Sync AttendanceSummary (Dashboard Accuracy)
  console.log("\n📊 Final Stage: Syncing Attendance Summaries for Dashboard...");
  
  const uniqueSubjectIds = [...new Set(timetables.map(t => t.subject_id))];

  for (const student of students) {
    for (const subjectId of uniqueSubjectIds) {
      // Find all records for this student/subject in this specific period
      const studentRecords = await prisma.attendanceRecord.findMany({
        where: {
          student_id: student.student_id,
          session: {
            subject_id: subjectId,
            timetable: {
              period_id: PERIOD_ID
            }
          }
        }
      });

      const total = studentRecords.length;
      const attended = studentRecords.filter(r => r.attendance_status === "PRESENT").length;
      const percentage = total > 0 ? (attended / total) * 100 : 0;
      const safeBunks = total > 0 ? Math.floor(attended / 0.8) - total : 0;

      await prisma.attendanceSummary.upsert({
        where: {
          student_id_subject_id_period_id: {
            student_id: student.student_id,
            subject_id: subjectId,
            period_id: PERIOD_ID,
          }
        },
        update: {
          total_classes: total,
          classes_attended: attended,
          classes_missed: total - attended,
          attendance_percentage: percentage,
          safe_bunks: safeBunks,
          last_updated: new Date(),
        },
        create: {
          summary_id: snowflake.generate(),
          student_id: student.student_id,
          subject_id: subjectId,
          period_id: PERIOD_ID,
          total_classes: total,
          classes_attended: attended,
          classes_missed: total - attended,
          attendance_percentage: percentage,
          safe_bunks: safeBunks,
        }
      });
    }
  }

  console.log("\n✨ SEEDING COMPLETE ✨");
  console.log("-----------------------------------------");
  console.log(`📁 Total Sessions: ${totalSessionsCreated}`);
  console.log(`👥 Total Records:  ${totalRecordsCreated}`);
  console.log(`📉 Summaries Synced: ${students.length * uniqueSubjectIds.length}`);
  console.log("-----------------------------------------");
  console.log("📚 Subject-Wise Distribution:");
  subjectDistribution.forEach((count, name) => {
    console.log(`   - ${name.padEnd(25)}: ${count} sessions`);
  });
  console.log("-----------------------------------------");
  console.log("Everything is now synchronized with your Dashboard.");
}

main()
  .catch(e => {
    console.error("❌ Critical Error during seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
