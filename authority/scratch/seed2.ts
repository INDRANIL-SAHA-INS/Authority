import { prisma } from "../lib/prisma";

async function add_more_subjects() {
  try {
    console.log("🌱 Adding 5 more subjects for variety...");

    const bca = await prisma.program.findUnique({ where: { program_code: "BCA" } });
    if (!bca) throw new Error("BCA program not found. Run seed.ts first.");

    const newSubjects = [
      { 
        subject_code: "BCA-501", 
        subject_name: "Cloud Computing", 
        program_id: bca.program_id, 
        semester_number: 5, 
        credits: 4, 
        subject_type: "Theory",
        lecture_hours: 45,
        description: "Introduction to cloud infrastructure and services.",
        syllabus_version: "2024.1"
      },
      { 
        subject_code: "BCA-502", 
        subject_name: "Mobile App Development", 
        program_id: bca.program_id, 
        semester_number: 5, 
        credits: 4, 
        subject_type: "Practical",
        practical_hours: 30,
        description: "Building cross-platform mobile applications.",
        syllabus_version: "2024.1"
      },
      { 
        subject_code: "BCA-503", 
        subject_name: "Artificial Intelligence", 
        program_id: bca.program_id, 
        semester_number: 5, 
        credits: 3, 
        subject_type: "Theory",
        lecture_hours: 40,
        description: "Foundations of AI and search algorithms.",
        syllabus_version: "2024.1"
      },
      { 
        subject_code: "BCA-504", 
        subject_name: "Data Science", 
        program_id: bca.program_id, 
        semester_number: 5, 
        credits: 4, 
        subject_type: "Theory",
        lecture_hours: 45,
        description: "Data analysis and statistical modeling.",
        syllabus_version: "2024.1"
      },
      { 
        subject_code: "BCA-505", 
        subject_name: "Web Technologies", 
        program_id: bca.program_id, 
        semester_number: 5, 
        credits: 3, 
        subject_type: "Practical",
        practical_hours: 30,
        description: "Modern web development with React and Node.js.",
        syllabus_version: "2024.1"
      },
    ];

    for (const sub of newSubjects) {
      await prisma.subject.upsert({
        where: { subject_code: sub.subject_code },
        update: sub,
        create: sub,
      });
      console.log(`✅ Subject ${sub.subject_code} ready.`);
    }
  } catch (error) {
    console.error("❌ Error adding subjects:", error);
  }
}

async function create_section_b() {
  try {
    console.log("🌱 Creating Section B for BCA Batch 2024...");

    const bcaBatch = await prisma.batch.findFirst({ where: { batch_name: "BCA Batch 2024" } });
    const classroom = await prisma.classroom.findUnique({ where: { room_number: "C-102" } }); // Different room

    if (!bcaBatch || !classroom) throw new Error("Batch or Classroom not found.");

    const sectionName = "BCA - Section B";
    
    await prisma.section.upsert({
      where: {
        // Manually check or use unique fields
        // Section doesn't have a unique name globally, but batch_id + section_name is common.
        // Schema only has @id. Let's find by name and batch_id.
        section_id: (await prisma.section.findFirst({ where: { section_name: sectionName, batch_id: bcaBatch.batch_id } }))?.section_id || 0
      },
      update: {
        classroom_id: classroom.classroom_id,
        status: "ACTIVE",
      },
      create: {
        section_name: sectionName,
        batch_id: bcaBatch.batch_id,
        classroom_id: classroom.classroom_id,
        section_strength: 60,
        building_name: classroom.building_name,
        floor_number: classroom.floor_number,
        status: "ACTIVE",
      },
    });
    console.log("✅ Section B ready.");
  } catch (error) {
    console.error("❌ Error creating section B:", error);
  }
}

async function seed_alice_timetable() {
  try {
    console.log("🌱 Seeding intensive timetable for Alice Smith (Teacher ID: 1)...");

    const alice = await prisma.teacher.findFirst({ where: { employee_id: "EMP-SOCSE-001" } });
    if (!alice) throw new Error("Teacher Alice Smith not found.");

    const period = await prisma.academicPeriod.findFirst({ where: { is_active: true } });
    if (!period) throw new Error("Active academic period not found.");

    const sections = await prisma.section.findMany({
      where: { section_name: { in: ["BCA - Section A", "BCA - Section B"] } }
    });
    const sectionA = sections.find(s => s.section_name === "BCA - Section A");
    const sectionB = sections.find(s => s.section_name === "BCA - Section B");

    if (!sectionA || !sectionB) throw new Error("Sections not found.");

    const subjects = await prisma.subject.findMany({
      where: { subject_code: { startsWith: "BCA-" } }
    });

    const slots = await prisma.timeSlot.findMany({
      where: { is_break: false },
      orderBy: { start_time: "asc" }
    });

    // Assign Alice to these subjects for Section B as well (she already has Section A in seed.ts)
    for (const sub of subjects) {
      await prisma.teacherSubjectAssignment.upsert({
        where: {
          teacher_id_subject_id_batch_id_section_id_period_id: {
            teacher_id: alice.teacher_id,
            subject_id: sub.subject_id,
            batch_id: sectionB.batch_id,
            section_id: sectionB.section_id,
            period_id: period.period_id,
          }
        },
        update: { assignment_status: "ACTIVE" },
        create: {
          teacher_id: alice.teacher_id,
          subject_id: sub.subject_id,
          batch_id: sectionB.batch_id,
          section_id: sectionB.section_id,
          period_id: period.period_id,
          assignment_role: "Primary Instructor",
          assigned_hours_per_week: 4,
          assignment_status: "ACTIVE"
        }
      });
    }

    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
    const rooms = await prisma.classroom.findMany();

    // Define 5 classes per day with variety specifically for Section B to avoid A's busy schedule
    // Avoid Slot 1 because Alice is already teaching Section A then
    const busySlot = slots.find(s => s.slot_name === "Slot 1");
    const freeSlots = slots.filter(s => s.time_slot_id !== busySlot?.time_slot_id);

    for (const day of days) {
      console.log(`📅 Generating schedule for ${day}...`);
      
      // Select 5 random slots from the free ones
      const dailySlots = [...freeSlots].sort(() => Math.random() - 0.5).slice(0, 5);
      
      for (let i = 0; i < dailySlots.length; i++) {
        const slot = dailySlots[i];
        const subject = subjects[i % subjects.length];
        
        // Use Section B for these 5 slots to avoid clashing with other teachers in Section A
        const section = sectionB; 
        const room_id = section.classroom_id || rooms[0].classroom_id;

        await prisma.timetable.upsert({
          where: {
            // Target the section-day-slot constraint to "own" the slot for Section B
            section_id_day_of_week_time_slot_id_period_id: {
                section_id: section.section_id,
                day_of_week: day,
                time_slot_id: slot.time_slot_id,
                period_id: period.period_id
            }
          },
          update: {
            teacher_id: alice.teacher_id,
            subject_id: subject.subject_id,
            batch_id: section.batch_id,
            classroom_id: room_id,
            timetable_status: "ACTIVE"
          },
          create: {
            teacher_id: alice.teacher_id,
            subject_id: subject.subject_id,
            batch_id: section.batch_id,
            section_id: section.section_id,
            classroom_id: room_id,
            period_id: period.period_id,
            day_of_week: day,
            time_slot_id: slot.time_slot_id,
            timetable_status: "ACTIVE",
          }
        });
      }
      console.log(`✅ 5 intensive classes seeded for ${day} in Section B.`);
    }

  } catch (error) {
    console.error("❌ Error seeding timetable:", error);
  }
}

async function main() {
  try {
    await add_more_subjects();
    await create_section_b();
    await seed_alice_timetable();
    console.log("✨ Seed2 finished successfully.");
  } catch (error) {
    console.error("❌ Seed2 failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
