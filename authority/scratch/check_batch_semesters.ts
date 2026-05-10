import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const connectionString = `${process.env.DATABASE_URL}`;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const studentId = BigInt("264786541312741376");

async function main() {
  // 1. Get the student and their batch
  const student = await prisma.student.findUnique({
    where: { student_id: studentId },
    select: { batch_id: true, first_name: true, last_name: true }
  });

  if (!student) {
    console.error("Student not found");
    return;
  }
  console.log(`Student: ${student.first_name} ${student.last_name} | Batch ID: ${student.batch_id}`);

  // 2. Check ALL batch_semesters for this batch
  const batchSemesters = await prisma.batchSemester.findMany({
    where: { batch_id: student.batch_id },
    include: { period: true },
    orderBy: { semester_number: "asc" }
  });

  if (batchSemesters.length === 0) {
    console.log("\n⚠️  NO BatchSemester records found for this batch!");
    console.log("This is why the /subjects API is returning 404.");
    console.log("The BatchSemester table is either empty or not linked to this batch.");
  } else {
    console.log(`\nFound ${batchSemesters.length} BatchSemester records:`);
    batchSemesters.forEach(bs => {
      console.log(`  Sem ${bs.semester_number} → Period: "${bs.period.name}" (period_id: ${bs.period_id}) | Status: ${bs.status}`);
    });
  }

  // 3. Also check all academic periods to cross-reference
  const allPeriods = await prisma.academicPeriod.findMany({
    orderBy: { created_at: "asc" }
  });
  console.log(`\nAll Academic Periods in DB:`);
  allPeriods.forEach(p => {
    console.log(`  [${p.is_active ? "ACTIVE" : "      "}] "${p.name}" | period_id: ${p.period_id}`);
  });
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
