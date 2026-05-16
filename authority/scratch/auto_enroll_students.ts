import { prisma } from "../lib/prisma";
import { generateSnowflake } from "../lib/snowflake";

/**
 * auto_enroll_students.ts
 *
 * PURPOSE: Creates SubjectEnrollment records for each student in the active period.
 *          Enrollment is derived from TeacherSubjectAssignment for the student's section,
 *          NOT from a hardcoded semester number on the Subject table.
 *
 * RUN ORDER: 3rd — Run AFTER auto_assign_subjects.ts and generate_timetable.ts
 * FIXES:
 *   - Previously fetched all Semester 4 subjects from the Subject table and enrolled
 *     ALL active students, regardless of program or section. This caused students
 *     to be enrolled in subjects outside their program.
 *   - Now derives enrollment from TeacherSubjectAssignment for the student's own section,
 *     ensuring enrollment exactly matches what's in the timetable.
 */

async function autoEnrollStudents() {
  console.log("🚀 Starting Automatic Student Enrollment...");

  try {
    // Step 1: Get the currently active academic period
    const activePeriod = await prisma.academicPeriod.findFirst({
      where: { is_active: true }
    });

    if (!activePeriod) {
      throw new Error("❌ No active academic period found. Please set a period to active first.");
    }
    console.log(`📅 Active Period: ${activePeriod.name} (${activePeriod.academic_year})`);

    // Step 2: Fetch all active students with their section info
    // Each student belongs to a section which has a specific set of assigned subjects
    const students = await prisma.student.findMany({
      where: { student_status: "ACTIVE" },
      include: { section: true }
    });

    if (students.length === 0) {
      throw new Error("❌ No active students found.");
    }
    console.log(`👤 Found ${students.length} active students.`);

    // Step 3: Build a cache of section_id → assigned subject_ids for efficiency.
    // Instead of querying TeacherSubjectAssignment once per student, we fetch all
    // assignments for the active period and group them by section_id in memory.
    const allAssignments = await prisma.teacherSubjectAssignment.findMany({
      where: {
        period_id: activePeriod.period_id,
        assignment_status: "ACTIVE"
      },
      select: {
        section_id: true,
        subject_id: true
      }
    });

    // Group subject_ids by section_id for O(1) lookup per student
    const sectionSubjectMap = new Map<string, bigint[]>();
    for (const assignment of allAssignments) {
      const key = assignment.section_id.toString();
      if (!sectionSubjectMap.has(key)) {
        sectionSubjectMap.set(key, []);
      }
      sectionSubjectMap.get(key)!.push(assignment.subject_id);
    }

    console.log(`📊 Loaded assignment data for ${sectionSubjectMap.size} sections.`);

    // Step 4: Enroll each student in the subjects assigned to their section.
    // This guarantees enrollment matches the timetable exactly.
    let enrollmentCount = 0;
    let skippedCount = 0;

    for (const student of students) {
      const sectionKey = student.section_id.toString();
      const subjectIds = sectionSubjectMap.get(sectionKey);

      if (!subjectIds || subjectIds.length === 0) {
        // No assignments found for this student's section — skip and warn
        console.warn(`⚠️  No assignments found for Section [${student.section.section_name}] — skipping ${student.first_name} ${student.last_name}`);
        skippedCount++;
        continue;
      }

      // Enroll student in each subject that is assigned to their section
      for (const subjectId of subjectIds) {
        try {
          await prisma.subjectEnrollment.upsert({
            where: {
              student_id_subject_id_period_id: {
                student_id: student.student_id,
                subject_id: subjectId,
                period_id: activePeriod.period_id,
              }
            },
            update: {
              // If enrollment already exists, mark it active (handles re-runs safely)
              status: "ACTIVE"
            },
            create: {
              enrollment_id: generateSnowflake(),
              student_id: student.student_id,
              subject_id: subjectId,
              period_id: activePeriod.period_id,
              status: "ACTIVE"
            }
          });
          enrollmentCount++;
        } catch (err: any) {
          console.error(`❌ Failed to enroll Student [${student.university_roll_number}] in Subject [${subjectId}]:`, err.message);
        }
      }

      console.log(`✅ Enrolled [${student.university_roll_number}] ${student.first_name} ${student.last_name} in ${subjectIds.length} subjects`);
    }

    console.log(`\n✨ Done! ${enrollmentCount} enrollments created. ${skippedCount} students skipped (no section assignments).`);

  } catch (error: any) {
    console.error("\n❌ Error during automatic enrollment:", error.message);
  } finally {
    await prisma.$disconnect();
  }
}

autoEnrollStudents();
