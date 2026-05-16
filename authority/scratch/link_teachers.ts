import { prisma } from "../lib/prisma";

async function linkTeachers() {
  console.log("🔍 Starting Teacher-User Linking Process...");
  
  try {
    // 1. Fetch all User accounts that have the role 'TEACHER'
    const teacherUsers = await prisma.user.findMany({
      where: { role: "TEACHER" }
    });

    console.log(`📊 Found ${teacherUsers.length} teacher accounts in the User table.`);

    let linkedCount = 0;
    let skippedCount = 0;

    for (const user of teacherUsers) {
      if (!user.account_identifier) {
        console.warn(`⚠️  User ${user.email} has no account_identifier. Skipping.`);
        skippedCount++;
        continue;
      }

      // 2. Find the Teacher record whose employee_id matches the User's account_identifier
      const teacherRecord = await prisma.teacher.findUnique({
        where: { employee_id: user.account_identifier }
      });

      if (teacherRecord) {
        // 3. Update the Teacher record with the correct user_id
        await prisma.teacher.update({
          where: { teacher_id: teacherRecord.teacher_id },
          data: { user_id: user.user_id }
        });
        console.log(`✅ Linked Teacher [${teacherRecord.first_name}] to User [${user.email}]`);
        linkedCount++;
      } else {
        console.warn(`❌ No Teacher record found with employee_id: ${user.account_identifier}`);
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

linkTeachers();
