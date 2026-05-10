import { prisma } from "../lib/prisma";


async function main() {
  console.log("--- Starting Batch Semester Population ---");

  // 1. Find your single batch
  const batch = await prisma.batch.findFirst();
  if (!batch) {
    console.error("❌ Error: No batch found in database. Please create a batch first.");
    return;
  }
  console.log(`✅ Found Batch: ${batch.batch_name} (ID: ${batch.batch_id})`);

  // 2. Find the Active Academic Period
  const activePeriod = await prisma.academicPeriod.findFirst({
    where: { is_active: true }
  });
  if (!activePeriod) {
    console.error("❌ Error: No active academic period found. Please mark one as active.");
    return;
  }
  console.log(`✅ Found Active Period: ${activePeriod.name} (ID: ${activePeriod.period_id})`);

  // 3. Find the Inactive Academic Period
  const inactivePeriod = await prisma.academicPeriod.findFirst({
    where: { is_active: false }
  });
  if (!inactivePeriod) {
    console.error("❌ Error: Could not find a second (inactive) period.");
    return;
  }
  console.log(`✅ Found Previous Period: ${inactivePeriod.name} (ID: ${inactivePeriod.period_id})`);

  // 4. Create the mappings
  console.log("\n--- Creating Mappings ---");

  // Map Active Period to Semester 4
  await prisma.batchSemester.upsert({
    where: {
      batch_id_period_id: {
        batch_id: batch.batch_id,
        period_id: activePeriod.period_id,
      }
    },
    update: { semester_number: 4, status: "ACTIVE" },
    create: {
      batch_id: batch.batch_id,
      period_id: activePeriod.period_id,
      semester_number: 4,
      status: "ACTIVE"
    }
  });
  console.log(`🚀 Mapped ${batch.batch_name} to ${activePeriod.name} as Semester 4 (ACTIVE)`);

  // Map Inactive Period to Semester 3
  await prisma.batchSemester.upsert({
    where: {
      batch_id_period_id: {
        batch_id: batch.batch_id,
        period_id: inactivePeriod.period_id,
      }
    },
    update: { semester_number: 3, status: "COMPLETED" },
    create: {
      batch_id: batch.batch_id,
      period_id: inactivePeriod.period_id,
      semester_number: 3,
      status: "COMPLETED"
    }
  });
  console.log(`📅 Mapped ${batch.batch_name} to ${inactivePeriod.name} as Semester 3 (COMPLETED)`);

  console.log("\n✅ Done! Your student should now see 'Semester 4' in the app.");
}

main()
  .catch((e) => {
    console.error("❌ Script Failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
