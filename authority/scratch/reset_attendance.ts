import { prisma } from "../lib/prisma";

// TARGET IDS (Same as seed script)
const SECTION_ID = BigInt("264579083378102272");
const PERIOD_ID = BigInt("264556692765675520");

async function main() {
  console.log("🧹 Starting Sequential Reset for Attendance Data...");

  try {
    // We use a transaction to ensure all-or-nothing deletion
    const result = await prisma.$transaction(async (tx) => {
      
      // 1. Delete Attendance Records (The 'Child' records)
      // These must go first because they depend on Sessions
      const recordResult = await tx.attendanceRecord.deleteMany({
        where: {
          session: {
            section_id: SECTION_ID,
            timetable: {
              period_id: PERIOD_ID
            }
          }
        }
      });
      console.log(`   🗑️  Deleted ${recordResult.count} AttendanceRecords.`);

      // 2. Delete Attendance Sessions (The 'Parent' records)
      const sessionResult = await tx.attendanceSession.deleteMany({
        where: {
          section_id: SECTION_ID,
          timetable: {
            period_id: PERIOD_ID
          }
        }
      });
      console.log(`   🗑️  Deleted ${sessionResult.count} AttendanceSessions.`);

      // 3. Delete Attendance Summaries (The Dashboard statistics)
      const summaryResult = await tx.attendanceSummary.deleteMany({
        where: {
          student: {
            section_id: SECTION_ID
          },
          period_id: PERIOD_ID
        }
      });
      console.log(`   🗑️  Deleted ${summaryResult.count} AttendanceSummaries.`);

      return {
        records: recordResult.count,
        sessions: sessionResult.count,
        summaries: summaryResult.count
      };
    });

    console.log("\n✨ RESET COMPLETE ✨");
    console.log("-----------------------------------------");
    console.log(`Successfully wiped ${result.records + result.sessions + result.summaries} targeted rows.`);
    console.log("-----------------------------------------");

  } catch (err) {
    console.error("❌ Reset Failed:", err);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
