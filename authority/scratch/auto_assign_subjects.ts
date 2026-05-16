import { prisma } from "../lib/prisma";
import { generateSnowflake } from "../lib/snowflake";

/**
 * auto_assign_subjects.ts
 *
 * PURPOSE: Creates TeacherSubjectAssignment records for the active academic period.
 *          Links each subject (of the correct semester for the active batch) to a teacher,
 *          scoped to a specific batch and section using round-robin distribution.
 *
 * RUN ORDER: 1st — Run this before generate_timetable.ts and auto_enroll_students.ts
 * FIXES:
 *   - Previously fetched subjects from Sem 3,4,5,6 mixed together for the same section.
 *   - Now fetches ONLY the subjects matching the current semester of the active batch.
 *   - Added program_id filter to ensure subjects belong to the batch's program.
 */

async function autoAssignSubjects() {
  console.log("🚀 Starting Automatic Teacher-Subject Assignment...");

  try {
    // Step 1: Get the currently active academic period
    const activePeriod = await prisma.academicPeriod.findFirst({
      where: { is_active: true }
    });

    if (!activePeriod) {
      throw new Error("❌ No active academic period found. Please set a period to active first.");
    }
    console.log(`📅 Active Period: ${activePeriod.name} (${activePeriod.academic_year})`);

    // Step 2: Fetch all active teachers to distribute subjects among
    const teachers = await prisma.teacher.findMany({
      where: { status: "ACTIVE" }
    });

    if (teachers.length === 0) {
      throw new Error("❌ No active teachers found in the database.");
    }
    console.log(`👨‍🏫 Found ${teachers.length} active teachers.`);

    // Step 3: Get the first active batch and its section
    // This determines which group of students we are scheduling for
    const batch = await prisma.batch.findFirst({
      where: { status: "ACTIVE" },
      include: { program: true }
    });

    if (!batch) throw new Error("❌ No active batch found.");

    const section = await prisma.section.findFirst({
      where: { batch_id: batch.batch_id, status: "ACTIVE" }
    });

    if (!section) {
      throw new Error(`❌ No active section found for batch ${batch.batch_name}.`);
    }
    console.log(`📦 Target: Batch [${batch.batch_name}] | Section [${section.section_name}] | Program [${batch.program.program_name}]`);

    // Step 4: Determine the current semester for this batch from BatchSemester table.
    // BatchSemester maps (batch_id + period_id) → semester_number.
    // This ensures we only assign subjects that the batch is ACTUALLY studying right now.
    const batchSemester = await prisma.batchSemester.findFirst({
      where: {
        batch_id: batch.batch_id,
        period_id: activePeriod.period_id
      }
    });

    if (!batchSemester) {
      throw new Error(
        `❌ No BatchSemester record found for batch [${batch.batch_name}] in period [${activePeriod.name}]. ` +
        `Please seed the batch_semesters table first.`
      );
    }
    console.log(`📖 Current Semester for this batch: Semester ${batchSemester.semester_number}`);

    // Step 5: Fetch ONLY the subjects for the correct semester AND the batch's program.
    // This prevents Sem 5 subjects appearing in a Sem 4 student's timetable.
    const subjects = await prisma.subject.findMany({
      where: {
        semester_number: batchSemester.semester_number, // ONLY current semester
        program_id: batch.program_id                    // ONLY this program's subjects
      },
      orderBy: { subject_code: "asc" }
    });

    if (subjects.length === 0) {
      throw new Error(
        `❌ No subjects found for Semester ${batchSemester.semester_number} ` +
        `in program [${batch.program.program_name}].`
      );
    }
    console.log(`📚 Found ${subjects.length} subjects for Semester ${batchSemester.semester_number}.`);

    // Step 6: Assign each subject to a teacher using round-robin distribution.
    // Round-robin ensures no teacher is overloaded — each gets an equal share.
    let assignedCount = 0;
    for (let i = 0; i < subjects.length; i++) {
      const subject = subjects[i];
      const teacher = teachers[i % teachers.length]; // cycles through teachers evenly

      try {
        await prisma.teacherSubjectAssignment.upsert({
          where: {
            teacher_id_subject_id_batch_id_section_id_period_id: {
              teacher_id: teacher.teacher_id,
              subject_id: subject.subject_id,
              batch_id: batch.batch_id,
              section_id: section.section_id,
              period_id: activePeriod.period_id,
            }
          },
          update: {
            // If assignment already exists, just ensure it is marked active
            assignment_status: "ACTIVE",
            assignment_role: "PRIMARY_INSTRUCTOR",
            assigned_hours_per_week: subject.credits || 4
          },
          create: {
            assignment_id: generateSnowflake(),
            teacher_id: teacher.teacher_id,
            subject_id: subject.subject_id,
            batch_id: batch.batch_id,
            section_id: section.section_id,
            period_id: activePeriod.period_id,
            assignment_status: "ACTIVE",
            assignment_role: "PRIMARY_INSTRUCTOR",
            assigned_hours_per_week: subject.credits || 4
          }
        });
        console.log(`✅ Assigned [${subject.subject_code}] ${subject.subject_name} → ${teacher.first_name} ${teacher.last_name}`);
        assignedCount++;
      } catch (err: any) {
        console.error(`❌ Failed to assign ${subject.subject_code}:`, err.message);
      }
    }

    console.log(`\n✨ Successfully created ${assignedCount} assignments across ${teachers.length} teachers.`);

  } catch (error: any) {
    console.error("\n❌ Error during automatic assignment:", error.message);
  } finally {
    await prisma.$disconnect();
  }
}

autoAssignSubjects();
