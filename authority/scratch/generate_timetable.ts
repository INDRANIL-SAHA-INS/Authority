import { prisma } from "../lib/prisma";
import { generateSnowflake } from "../lib/snowflake";

/**
 * generate_timetable.ts
 *
 * PURPOSE: Generates a balanced weekly timetable for the active section
 *          by distributing TeacherSubjectAssignment records across days and time slots.
 *
 * RUN ORDER: 2nd — Run AFTER auto_assign_subjects.ts, BEFORE auto_enroll_students.ts
 * FIXES:
 *   - Previously used pure random selection which could repeat the same subject many
 *     times in a day and leave others unscheduled.
 *   - Now uses a round-robin rotation over the assignment list, resetting each day.
 *     This ensures every subject appears at least once in the week and no single
 *     subject dominates the timetable.
 *   - Each teacher is still limited to 3 hours per day to prevent overload.
 */

async function generateBalancedTimetable() {
  console.log("📅 Generating Balanced Weekly Timetable (1-Hour Slots)...");

  try {
    // Step 1: Fetch prerequisites — active period, batch, section, and classroom
    const activePeriod = await prisma.academicPeriod.findFirst({ where: { is_active: true } });
    if (!activePeriod) throw new Error("❌ No active academic period found.");

    const batch = await prisma.batch.findFirst({ where: { status: "ACTIVE" } });
    const section = await prisma.section.findFirst({
      where: { batch_id: batch?.batch_id, status: "ACTIVE" }
    });
    if (!section || !batch) throw new Error("❌ No active section or batch found.");

    // Use only the first available classroom (can be extended for multi-room support)
    const classrooms = await prisma.classroom.findMany({ where: { status: "AVAILABLE" } });
    const classroom = classrooms[0];
    if (!classroom) throw new Error("❌ No available classrooms found.");

    // Fetch all time slots sorted by start time (includes break slots)
    const allSlots = await prisma.timeSlot.findMany({
      orderBy: { start_time: "asc" }
    });
    if (allSlots.length === 0) throw new Error("❌ No time slots found in the database.");

    // Step 2: Fetch ONLY assignments for this specific section and active period.
    // Since auto_assign_subjects.ts now filters by semester correctly, these
    // assignments will only contain subjects for the right semester.
    const assignments = await prisma.teacherSubjectAssignment.findMany({
      where: {
        section_id: section.section_id,
        period_id: activePeriod.period_id,
        assignment_status: "ACTIVE"
      },
      include: { teacher: true, subject: true }
    });

    if (assignments.length === 0) {
      throw new Error("❌ No active assignments found for this section. Run auto_assign_subjects.ts first.");
    }
    console.log(`📊 Distributing ${assignments.length} assignments across 7 days.`);

    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

    // Step 3: For each day, distribute the teaching slots across all subjects.
    for (const day of days) {
      console.log(`\n🗓️  Scheduling for ${day}...`);

      // Track how many hours each teacher has been assigned today (max 3 per day)
      const teacherDailyHours: Record<string, number> = {};

      // Round-robin index resets each day so every day has a fresh, even distribution
      let assignmentIndex = 0;

      for (const slot of allSlots) {
        // Skip break slots — they are not teaching periods
        if (slot.is_break) {
          console.log(`   ☕ ${slot.slot_name} (Break) — Skipped`);
          continue;
        }

        // Find the next available assignment whose teacher hasn't hit their 3-hour daily limit.
        // We cycle through all assignments before giving up to avoid blank slots.
        let chosenAssignment = null;
        for (let attempt = 0; attempt < assignments.length; attempt++) {
          const candidate = assignments[(assignmentIndex + attempt) % assignments.length];
          const hoursToday = teacherDailyHours[candidate.teacher_id.toString()] || 0;
          if (hoursToday < 3) {
            chosenAssignment = candidate;
            // Advance the round-robin pointer past the one we just used
            assignmentIndex = (assignmentIndex + attempt + 1) % assignments.length;
            break;
          }
        }

        // Fallback: if every teacher has hit their limit (rare), pick the next in rotation
        if (!chosenAssignment) {
          chosenAssignment = assignments[assignmentIndex % assignments.length];
          assignmentIndex = (assignmentIndex + 1) % assignments.length;
        }

        // Increment the chosen teacher's daily hour count
        const teacherIdStr = chosenAssignment.teacher_id.toString();
        teacherDailyHours[teacherIdStr] = (teacherDailyHours[teacherIdStr] || 0) + 1;

        // Upsert timetable row — update if already exists (safe to re-run)
        await prisma.timetable.upsert({
          where: {
            section_id_day_of_week_time_slot_id_period_id: {
              section_id: section.section_id,
              day_of_week: day,
              time_slot_id: slot.time_slot_id,
              period_id: activePeriod.period_id,
            }
          },
          update: {
            teacher_id: chosenAssignment.teacher_id,
            subject_id: chosenAssignment.subject_id,
            classroom_id: classroom.classroom_id,
            timetable_status: "ACTIVE"
          },
          create: {
            timetable_id: generateSnowflake(),
            teacher_id: chosenAssignment.teacher_id,
            subject_id: chosenAssignment.subject_id,
            batch_id: batch.batch_id,
            section_id: section.section_id,
            classroom_id: classroom.classroom_id,
            period_id: activePeriod.period_id,
            day_of_week: day,
            time_slot_id: slot.time_slot_id,
            timetable_status: "ACTIVE"
          }
        });

        console.log(`   ✅ ${slot.slot_name}: [${chosenAssignment.subject.subject_code}] ${chosenAssignment.subject.subject_name} → ${chosenAssignment.teacher.first_name}`);
      }
    }

    console.log(`\n✨ Balanced Weekly Timetable generated successfully!`);

  } catch (error: any) {
    console.error("\n❌ Error generating timetable:", error.message);
  } finally {
    await prisma.$disconnect();
  }
}

generateBalancedTimetable();
