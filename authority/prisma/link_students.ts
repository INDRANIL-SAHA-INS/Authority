import { prisma } from "../lib/prisma";

async function linkStudents() {
  console.log("🔍 Starting Student-User Linking Process...");
  
  try {
    // 1. Fetch all User accounts that have the role 'STUDENT'
    const studentUsers = await prisma.user.findMany({
      where: { role: "STUDENT" }
    });

    console.log(`📊 Found ${studentUsers.length} student accounts in the User table.`);

    let linkedCount = 0;
    let skippedCount = 0;

    for (const user of studentUsers) {
      if (!user.account_identifier) {
        console.warn(`⚠️  User ${user.email} has no account_identifier. Skipping.`);
        skippedCount++;
        continue;
      }

      // 2. Find the Student record whose university_roll_number matches the User's account_identifier
      const studentRecord = await prisma.student.findUnique({
        where: { university_roll_number: user.account_identifier }
      });

      if (studentRecord) {
        // 3. Update the Student record with the correct user_id
        await prisma.student.update({
          where: { student_id: studentRecord.student_id },
          data: { user_id: user.user_id }
        });
        console.log(`✅ Linked Student [${studentRecord.first_name}] to User [${user.email}]`);
        linkedCount++;
      } else {
        console.warn(`❌ No Student record found with university_roll_number: ${user.account_identifier}`);
        skippedCount++;
      }
    }

    console.log(`\n✨ Linking Finished!`);
    console.log(`✅ Successfully Linked: ${linkedCount}`);
    console.log(`⚠️  Skipped/Failed: ${skippedCount}`);

  } catch (error: any) {
    console.error("❌ An error occurred during linking:", error.message);
  } finally {
    await prisma.$disconnect();
  }
}

linkStudents();
