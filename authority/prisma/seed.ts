import { prisma } from "../lib/prisma";
import crypto from "node:crypto";

async function seed_classrooms() {
  try {
    console.log("🌱 Starting classroom seeding...");

    const classrooms = [
      {
        room_number: "C-101",
        building_name: "C Block",
        floor_number: 1,
        seating_capacity: 60,
        projector_available: true,
        smart_board_available: true,
        status: "AVAILABLE",
      },
      {
        room_number: "C-102",
        building_name: "C Block",
        floor_number: 1,
        seating_capacity: 45,
        projector_available: false,
        smart_board_available: false,
        status: "AVAILABLE",
      },
      {
        room_number: "B-201",
        building_name: "B Block",
        floor_number: 2,
        seating_capacity: 30,
        projector_available: true,
        smart_board_available: false,
        status: "AVAILABLE",
      },
      {
        room_number: "A-305",
        building_name: "A Block",
        floor_number: 3,
        seating_capacity: 120,
        projector_available: true,
        smart_board_available: true,
        status: "AVAILABLE",
      },
      {
        room_number: "A-101",
        building_name: "A Block",
        floor_number: 0,
        seating_capacity: 250,
        projector_available: true,
        smart_board_available: true,
        status: "AVAILABLE",
      },
    ];

    // Using upsert instead of createMany to avoid errors if run twice
    for (const room of classrooms) {
      await prisma.classroom.upsert({
        where: { room_number: room.room_number },
        update: {},
        create: room,
      });
    }
  } catch (error) {
    console.error("❌ Error seeding classrooms:", error);
  }
}

async function seed_time_slots() {
  try {
    console.log("🌱 Starting time slot seeding...");

    // Times as specified: 9:00 start, 1hr classes, lunch 1:00-2:00, till 5:00
    const slots = [
      { name: "Slot 1", start: "09:00", end: "10:00", is_break: false },
      { name: "Slot 2", start: "10:00", end: "11:00", is_break: false },
      { name: "Slot 3", start: "11:00", end: "12:00", is_break: false },
      { name: "Slot 4", start: "12:00", end: "13:00", is_break: false },
      { name: "Lunch Break", start: "13:00", end: "14:00", is_break: true },
      { name: "Slot 5", start: "14:00", end: "15:00", is_break: false },
      { name: "Slot 6", start: "15:00", end: "16:00", is_break: false },
      { name: "Slot 7", start: "16:00", end: "17:00", is_break: false },
    ];

    for (const slot of slots) {
      // Use a fixed date part for the postgres Time type
      const startTime = new Date(`1970-01-01T${slot.start}:00Z`);
      const endTime = new Date(`1970-01-01T${slot.end}:00Z`);
      
      // Calculate duration in minutes
      const duration = (endTime.getTime() - startTime.getTime()) / (1000 * 60);

      await prisma.timeSlot.upsert({
        where: { slot_name: slot.name },
        update: {
          start_time: startTime,
          end_time: endTime,
          duration_minutes: duration,
          is_break: slot.is_break,
        },
        create: {
          slot_name: slot.name,
          start_time: startTime,
          end_time: endTime,
          duration_minutes: duration,
          is_break: slot.is_break,
        },
      });
      console.log(`✅ ${slot.name} (${slot.start} - ${slot.end}) ready.`);
    }
  } catch (error) {
    console.error("❌ Error seeding time slots:", error);
  }
}

async function seed_academic_periods() {
  try {
    console.log("🌱 Starting academic period seeding...");

    const periods = [
      {
        name: "BCA Aug-Dec 2025",
        academic_year: "2025-26",
        term_type: "ODD",
        is_active: false,
        start_date: new Date("2025-08-01"),
        end_date: new Date("2025-12-31"),
      },
      {
        name: "BCA Jan-May 2026",
        academic_year: "2025-26",
        term_type: "EVEN",
        is_active: true, // Assuming this is current
        start_date: new Date("2026-01-01"),
        end_date: new Date("2026-05-31"),
      },
    ];

    for (const period of periods) {
      await prisma.academicPeriod.upsert({
        where: {
          name_academic_year: {
            name: period.name,
            academic_year: period.academic_year,
          },
        },
        update: {
          term_type: period.term_type,
          is_active: period.is_active,
          start_date: period.start_date,
          end_date: period.end_date,
        },
        create: period,
      });
      console.log(`✅ ${period.name} ready.`);
    }
  } catch (error) {
    console.error("❌ Error seeding academic periods:", error);
  }
}


async function seed_departments() {
  try {
    console.log("🌱 Starting department seeding...");

    const departments = [
      {
        department_code: "SOCSE",
        department_name: "School of Computer Science and Engineering",
        // department_head_id: 101, // Skipping for now as Teachers are not seeded yet (refer to Step 2 in DATA_SEEDING_ORDER.md)
        office_location: "Block A - Room 204",
        contact_email: "socse@college.edu",
        contact_phone: "9876543210",
        established_year: 2022,
        status: "active",
      },
      {
        department_code: "SOL",
        department_name: "School of Law",
        // department_head_id: 102,
        office_location: "Block B - Room 110",
        contact_email: "sol@college.edu",
        contact_phone: "9876501234",
        established_year: 2022,
        status: "active",
      },
      {
        department_code: "SOB",
        department_name: "School of Business",
        // department_head_id: 103,
        office_location: "Block C - Room 305",
        contact_email: "sob@college.edu",
        contact_phone: "9123456780",
        established_year: 2022,
        status: "active",
      },
    ];

    for (const dept of departments) {
      await prisma.department.upsert({
        where: { department_code: dept.department_code },
        update: dept,
        create: dept,
      });
      console.log(`✅ ${dept.department_code} ready.`);
    }
  } catch (error) {
    console.error("❌ Error seeding departments:", error);
  }
}


async function seed_teachers() {
  try {
    console.log("🌱 Starting teacher seeding...");

    const socseDept = await prisma.department.findUnique({ where: { department_code: "SOCSE" } });
    const solDept = await prisma.department.findUnique({ where: { department_code: "SOL" } });
    const sobDept = await prisma.department.findUnique({ where: { department_code: "SOB" } });

    if (!socseDept || !solDept || !sobDept) {
      throw new Error("Could not find departments. Ensure departments are seeded first.");
    }

    const teacherData = [
      {
        employee_id: "EMP-SOCSE-001",
        first_name: "Alice",
        last_name: "Smith",
        gender: "Female",
        dept: socseDept,
        designation: "Professor",
        qualification: "Ph.D. in CS",
        specialization: "AI & Machine Learning",
        email: "alice.smith@college.edu",
        phone_number: "9988776601",
        date_of_birth: new Date("1985-05-15"),
        joining_date: new Date("2020-01-10"),
        experience_years: 15,
        office_room: "A-204",
        employment_type: "Full-time",
      },
      {
        employee_id: "EMP-SOCSE-002",
        first_name: "Robert",
        last_name: "Brown",
        gender: "Male",
        dept: socseDept,
        designation: "Associate Professor",
        qualification: "M.Tech in CS",
        specialization: "Cyber Security",
        email: "robert.brown@college.edu",
        phone_number: "9988776604",
        date_of_birth: new Date("1988-11-25"),
        joining_date: new Date("2021-07-20"),
        experience_years: 12,
        office_room: "A-205",
        employment_type: "Full-time",
      },
      {
        employee_id: "EMP-SOCSE-003",
        first_name: "Charlie",
        last_name: "Green",
        gender: "Male",
        dept: socseDept,
        designation: "Assistant Professor",
        qualification: "M.Tech",
        specialization: "Database Systems",
        email: "charlie.green@college.edu",
        phone_number: "9988776607",
        date_of_birth: new Date("1992-03-12"),
        joining_date: new Date("2022-06-01"),
        experience_years: 5,
        office_room: "A-206",
        employment_type: "Full-time",
      },
      {
        employee_id: "EMP-SOCSE-004",
        first_name: "David",
        last_name: "White",
        gender: "Male",
        dept: socseDept,
        designation: "Professor",
        qualification: "Ph.D.",
        specialization: "Operating Systems",
        email: "david.white@college.edu",
        phone_number: "9988776608",
        date_of_birth: new Date("1980-07-22"),
        joining_date: new Date("2015-01-15"),
        experience_years: 20,
        office_room: "A-207",
        employment_type: "Full-time",
      },
      {
        employee_id: "EMP-SOCSE-005",
        first_name: "Eve",
        last_name: "Black",
        gender: "Female",
        dept: socseDept,
        designation: "Assistant Professor",
        qualification: "M.Sc CS",
        specialization: "Software Engineering",
        email: "eve.black@college.edu",
        phone_number: "9988776609",
        date_of_birth: new Date("1994-11-30"),
        joining_date: new Date("2023-08-10"),
        experience_years: 3,
        office_room: "A-208",
        employment_type: "Full-time",
      },
      {
        employee_id: "EMP-SOL-001",
        first_name: "John",
        last_name: "Doe",
        gender: "Male",
        dept: solDept,
        designation: "Assistant Professor",
        qualification: "LL.M.",
        specialization: "Criminal Law",
        email: "john.doe@college.edu",
        phone_number: "9988776602",
        date_of_birth: new Date("1990-08-20"),
        joining_date: new Date("2022-03-15"),
        experience_years: 8,
        office_room: "B-110",
        employment_type: "Full-time",
      },
    ];

    for (let i = 0; i < teacherData.length; i++) {
      const data = teacherData[i];
      
      // 1. Check if teacher already exists by their unique employee_id (deterministic)
      const existing = await prisma.teacher.findUnique({
        where: { employee_id: data.employee_id }
      });

      // 2. employee_id is now hardcoded in seed data — no random generation
      const employeeId = data.employee_id;

      await prisma.teacher.upsert({
        where: { employee_id: employeeId },
        update: {
          first_name: data.first_name,
          last_name: data.last_name,
          designation: data.designation,
          qualification: data.qualification,
          specialization: data.specialization,
          phone_number: data.phone_number,
          experience_years: data.experience_years,
          office_room: data.office_room,
          status: "ACTIVE",
        },
        create: {
          employee_id: employeeId,
          first_name: data.first_name,
          last_name: data.last_name,
          gender: data.gender,
          department_id: data.dept.department_id,
          designation: data.designation,
          qualification: data.qualification,
          specialization: data.specialization,
          phone_number: data.phone_number,
          date_of_birth: data.date_of_birth,
          joining_date: data.joining_date,
          experience_years: data.experience_years,
          office_room: data.office_room,
          employment_type: data.employment_type,
          status: "ACTIVE",
        },
      });
      console.log(`✅ Teacher ${data.first_name} ${data.last_name} ready (ID: ${employeeId}).`);
    }
  } catch (error) {
    console.error("❌ Error seeding teachers:", error);
  }
}


async function seed_programs() {
  try {
    console.log("🌱 Starting program seeding...");

    const socseDept = await prisma.department.findUnique({ where: { department_code: "SOCSE" } });
    const solDept = await prisma.department.findUnique({ where: { department_code: "SOL" } });
    const sobDept = await prisma.department.findUnique({ where: { department_code: "SOB" } });

    if (!socseDept || !solDept || !sobDept) {
      throw new Error("Could not find departments. Ensure departments are seeded first.");
    }

    const programs = [
      {
        program_code: "BCA",
        program_name: "Bachelor of Computer Applications",
        degree_type: "Undergraduate",
        program_duration_years: 4,
        total_semesters: 8,
        department_id: socseDept.department_id,
        status: "ACTIVE",
      },
    ];

    for (const program of programs) {
      await prisma.program.upsert({
        where: { program_code: program.program_code },
        update: program,
        create: program,
      });
      console.log(`✅ Program ${program.program_code} ready.`);
    }
  } catch (error) {
    console.error("❌ Error seeding programs:", error);
  }
}


async function seed_subjects() {
  try {
    console.log("🌱 Starting subject seeding...");

    const bca = await prisma.program.findUnique({ where: { program_code: "BCA" } });

    if (!bca) {
      throw new Error("Could not find programs. Ensure programs are seeded first.");
    }

    const subjects = [
      // BCA Subjects
      { subject_code: "BCA-301", subject_name: "Database Management Systems", program_id: bca.program_id, semester_number: 3, credits: 4, subject_type: "Theory" },
      { subject_code: "BCA-302", subject_name: "Operating Systems", program_id: bca.program_id, semester_number: 3, credits: 4, subject_type: "Theory" },
      { subject_code: "BCA-401", subject_name: "Software Engineering", program_id: bca.program_id, semester_number: 4, credits: 3, subject_type: "Theory" },
      { subject_code: "BCA-402", subject_name: "Java Programming", program_id: bca.program_id, semester_number: 4, credits: 4, subject_type: "Practical" },
      { subject_code: "BCA-403", subject_name: "Computer Networks", program_id: bca.program_id, semester_number: 4, credits: 3, subject_type: "Theory" },
      
      // New Subjects for Alice Smith (Teacher ID 1)
      { subject_code: "BCA-501", subject_name: "Artificial Intelligence", program_id: bca.program_id, semester_number: 5, credits: 4, subject_type: "Theory" },
      { subject_code: "BCA-502", subject_name: "Cloud Computing", program_id: bca.program_id, semester_number: 5, credits: 4, subject_type: "Theory" },
      { subject_code: "BCA-503", subject_name: "Data Science", program_id: bca.program_id, semester_number: 5, credits: 4, subject_type: "Theory" },
      { subject_code: "BCA-504", subject_name: "Mobile App Development", program_id: bca.program_id, semester_number: 5, credits: 4, subject_type: "Theory" },
      { subject_code: "BCA-505", subject_name: "Cyber Security", program_id: bca.program_id, semester_number: 5, credits: 4, subject_type: "Theory" },
    ];

    for (const subject of subjects) {
      await prisma.subject.upsert({
        where: { subject_code: subject.subject_code },
        update: subject,
        create: subject,
      });
      console.log(`✅ Subject ${subject.subject_code} ready.`);
    }
  } catch (error) {
    console.error("❌ Error seeding subjects:", error);
  }
}


async function seed_batches() {
  try {
    console.log("🌱 Starting batch seeding...");

    const bca = await prisma.program.findUnique({ where: { program_code: "BCA" } });
    const period = await prisma.academicPeriod.findFirst({ where: { name: "BCA Jan-May 2026" } });

    if (!bca || !period) {
      throw new Error("Could not find program (BCA) or active period. Ensure they are seeded first.");
    }

    const batchConfigs = [
      { program: bca, prefix: "BCA", duration: 3 },
    ];

    for (const config of batchConfigs) {
      const batchName = `${config.prefix} Batch 2024`;
      const admissionYear = 2024;
      const gradYear = admissionYear + config.duration;

      // Check if batch exists manually for idempotency
      const existing = await prisma.batch.findFirst({
        where: {
          batch_name: batchName,
          program_id: config.program.program_id,
        },
      });

      if (existing) {
        console.log(`ℹ️ Batch ${batchName} already exists.`);
        continue;
      }

      await prisma.batch.create({
        data: {
          batch_name: batchName,
          program_id: config.program.program_id,
          period_id: period.period_id,
          admission_year: admissionYear,
          expected_graduation_year: gradYear,
          total_students: 120,
          status: "ACTIVE",
          batch_semesters: {
            create: [
              {
                period_id: period.period_id,
                semester_number: 4 // Hardcoded to 4 based on your existing subject assignments
              }
            ]
          }
        },
      });
      console.log(`✅ Batch ${batchName} ready.`);
    }
  } catch (error) {
    console.error("❌ Error seeding batches:", error);
  }
}


async function seed_sections() {
  try {
    console.log("🌱 Starting section seeding...");

    const bcaBatch = await prisma.batch.findFirst({ where: { batch_name: "BCA Batch 2024" } });
    const classrooms = await prisma.classroom.findMany();

    if (!bcaBatch || classrooms.length === 0) {
      throw new Error("Missing prerequisite data: BCA batch not found or no classrooms available.");
    }

    const sectionConfigs = [
      { batch: bcaBatch, count: 1, prefix: "BCA", baseStrength: 120 },
    ];

    let classroomIndex = 0;
    for (const config of sectionConfigs) {
      for (let i = 0; i < config.count; i++) {
        const sectionLetter = String.fromCharCode(65 + i); // A, B, C...
        const sectionName = `${config.prefix} - Section ${sectionLetter}`;
        const classroom = classrooms[classroomIndex % classrooms.length];
        classroomIndex++;

        // Check if section exists manually for idempotency
        const existing = await prisma.section.findFirst({
          where: {
            section_name: sectionName,
            batch_id: config.batch.batch_id,
          },
        });

        if (existing) {
          console.log(`ℹ️ Section ${sectionName} already exists.`);
          continue;
        }

        await prisma.section.create({
          data: {
            section_name: sectionName,
            batch_id: config.batch.batch_id,
            classroom_id: classroom.classroom_id,
            section_strength: config.baseStrength,
            building_name: classroom.building_name,
            floor_number: classroom.floor_number,
            status: "ACTIVE",
          },
        });
        console.log(`✅ Section ${sectionName} ready (Assigned to ${classroom.room_number}).`);
      }
    }
  } catch (error) {
    console.error("❌ Error seeding sections:", error);
  }
}


async function seed_students() {
  try {
    console.log("🌱 Starting student seeding...");

    const sections = await prisma.section.findMany({
      include: {
        batch: {
          include: {
            program: true
          }
        }
      }
    });

    if (sections.length === 0) {
      throw new Error("No sections found. Ensure sections are seeded first.");
    }

    const studentsData = [
      { firstName: "Aarav", lastName: "Sharma", gender: "Male" },
      { firstName: "Ananya", lastName: "Verma", gender: "Female" },
      { firstName: "Ishaan", firstName_2: "Gupta", lastName: "Gupta", gender: "Male" }, // Fixed duplication in my head
      { firstName: "Diya", lastName: "Malhotra", gender: "Female" },
      { firstName: "Reyansh", lastName: "Joshi", gender: "Male" },
      { firstName: "Meera", lastName: "Singhania", gender: "Female" },
      { firstName: "Kabir", lastName: "Chopra", gender: "Male" },
      { firstName: "Zara", lastName: "Reddy", gender: "Female" },
      { firstName: "Vihaan", lastName: "Patel", gender: "Male" },
      { firstName: "Saanvi", lastName: "Nair", gender: "Female" },
    ];

    let globalCount = 1;

    for (const section of sections) {
      console.log(`👤 Seeding students for section: ${section.section_name}`);
      
      for (const data of studentsData) {
        const { firstName, lastName, gender } = data;
        
        // Calculation Logic:
        const year = section.batch.admission_year?.toString().slice(-2) || "24";
        const prog = (section.batch.program.program_code || "BCA").toUpperCase().replace(/\s+/g, "").replace(/\./g, ""); 
        
        // Email: No spaces, all lowercase
        const email = `${firstName}${lastName}${prog}${year}@rvu.edu.in`.toLowerCase().replace(/\s+/g, "");
        
        // Roll Number: 1RUA + 24 + BCA + 0001
        const roll = `1RUA${year}${prog}${String(globalCount).padStart(4, "0")}`;

        await prisma.student.upsert({
          where: { university_roll_number: roll },
          update: {
            first_name: firstName,
            last_name: lastName,
            gender: gender,
            student_status: "ACTIVE",
          },
          create: {
            first_name: firstName,
            last_name: lastName,
            university_roll_number: roll,
            registration_number: `REG-${roll}`,
            gender: gender,
            date_of_birth: new Date("2006-05-15"),
            batch_id: section.batch_id,
            section_id: section.section_id,
            program_id: section.batch.program_id,
            admission_date: new Date("2024-08-01"),
            student_status: "ACTIVE",
            phone_number: `98765${String(globalCount).padStart(5, "0")}`,
            blood_group: "O+",
            nationality: "Indian",
            address: "RV University Campus, Bengaluru",
            city: "Bengaluru",
            state: "Karnataka",
          }
        });
        
        console.log(`✅ Student ${firstName} ${lastName} ready (${email}). Roll: ${roll}`);
        globalCount++;
      }
    }
  } catch (error) {
    console.error("❌ Error seeding students:", error);
  }
}


async function seed_guardians() {
  try {
    console.log("🌱 Starting guardian seeding...");

    const students = await prisma.student.findMany();

    if (students.length === 0) {
      throw new Error("No students found. Ensure students are seeded first.");
    }

    const fatherSurnames = ["Sharma", "Verma", "Gupta", "Malhotra", "Joshi", "Singhania", "Chopra", "Reddy", "Patel", "Nair"];
    const fatherFirstNames = ["Rajesh", "Suresh", "Ramesh", "Sunil", "Anil", "Vijay", "Sanjay", "Arun", "Vikas", "Manish"];
    const motherFirstNames = ["Sunita", "Anita", "Geeta", "Seema", "Meena", "Pushpa", "Rani", "Kiran", "Usha", "Deepa"];

    for (const student of students) {
      const fName = fatherFirstNames[Math.floor(Math.random() * fatherFirstNames.length)];
      const mName = motherFirstNames[Math.floor(Math.random() * motherFirstNames.length)];
      const lName = student.last_name || fatherSurnames[Math.floor(Math.random() * fatherSurnames.length)];

      // Check if guardian exists for this student (unique constraint)
      const existing = await prisma.guardian.findUnique({
        where: { student_id: student.student_id }
      });

      if (existing) {
        console.log(`ℹ️ Guardian for student ${student.first_name} already exists.`);
        continue;
      }

      await prisma.guardian.create({
        data: {
          student_id: student.student_id,
          father_name: `${fName} ${lName}`,
          mother_name: `${mName} ${lName}`,
          guardian_name: `${fName} ${lName}`, // Primarily father as guardian
          relation_type: "Father",
          phone_number: `998877${Math.floor(1000 + Math.random() * 9000)}0`,
          email: `${fName.toLowerCase()}${lName.toLowerCase()}@gmail.com`,
          occupation: "Private Service",
          address: "RV University Campus, Bengaluru",
          city: "Bengaluru",
          state: "Karnataka",
          postal_code: "560059",
        }
      });
      console.log(`✅ Guardian record created for student ${student.first_name} ${student.last_name}.`);
    }
  } catch (error) {
    console.error("❌ Error seeding guardians:", error);
  }
}


async function seed_subject_enrollments() {
  try {
    console.log("🌱 Starting subject enrollment seeding...");

    // 1. Fetch students WITH their active BatchSemester
    const students = await prisma.student.findMany({
      include: {
        batch: {
          include: {
            batch_semesters: {
              where: { status: "ACTIVE" }
            }
          }
        },
        program: true
      }
    });

    if (students.length === 0) {
      throw new Error("No students found. Ensure students are seeded first.");
    }

    for (const student of students) {
      const activeSemRecord = student.batch.batch_semesters[0];
      
      if (!activeSemRecord) {
        console.log(`⚠️ Student ${student.first_name}'s batch has no active semester.`);
        continue;
      }

      const currentSemesterNumber = activeSemRecord.semester_number;
      // We explicitly use the period_id linked directly to this specific semester execution
      const periodId = activeSemRecord.period_id;

      // 2. Dynamically fetch subjects for their program AND their actual active semester
      const subjects = await prisma.subject.findMany({
        where: {
          program_id: student.program_id,
          semester_number: currentSemesterNumber
        }
      });

      if (subjects.length === 0) {
        console.log(`⚠️ No sem ${currentSemesterNumber} subjects found for program ${student.program.program_code}.`);
        continue;
      }

      // 3. Enroll them in those subjects
      for (const subject of subjects) {
        // Idempotency: using composite unique index
        await prisma.subjectEnrollment.upsert({
          where: {
            student_id_subject_id_period_id: {
              student_id: student.student_id,
              subject_id: subject.subject_id,
              period_id: periodId
            }
          },
          update: {
            status: "ACTIVE"
          },
          create: {
            student_id: student.student_id,
            subject_id: subject.subject_id,
            period_id: periodId,
            status: "ACTIVE"
          }
        });
      }
      console.log(`✅ Successfully enrolled ${student.first_name} into ${subjects.length} subjects for Semester ${currentSemesterNumber}.`);
    }
  } catch (error) {
    console.error("❌ Error seeding subject enrollments:", error);
  }
}

async function seed_teacher_assignments() {
  try {
    console.log("🌱 Starting teacher subject assignment seeding...");

    // 1. Find our 5 Teachers
    const t1 = await prisma.teacher.findUnique({ where: { employee_id: "EMP-SOCSE-001" } }); // Alice Smith
    const t2 = await prisma.teacher.findUnique({ where: { employee_id: "EMP-SOCSE-003" } }); // Charlie Green
    const t3 = await prisma.teacher.findUnique({ where: { employee_id: "EMP-SOCSE-004" } }); // David White
    const t4 = await prisma.teacher.findUnique({ where: { employee_id: "EMP-SOCSE-005" } }); // Eve Black
    const t5 = await prisma.teacher.findUnique({ where: { employee_id: "EMP-SOCSE-002" } }); // Robert Brown

    if (!t1 || !t2 || !t3 || !t4 || !t5) throw new Error("Could not find all 5 teachers for BCA.");

    // 2. Find the BCA section A
    const bcaSectionA = await prisma.section.findFirst({
      where: { section_name: "BCA - Section A" },
      include: {
        batch: {
          include: {
            batch_semesters: { where: { status: "ACTIVE" } }
          }
        }
      }
    });

    if (!bcaSectionA) throw new Error("Could not find BCA Section A.");

    // 3. Find subjects to assign
    const s1 = await prisma.subject.findUnique({ where: { subject_code: "BCA-301" } }); // DBMS
    const s2 = await prisma.subject.findUnique({ where: { subject_code: "BCA-302" } }); // OS
    const s3 = await prisma.subject.findUnique({ where: { subject_code: "BCA-401" } }); // SE
    const s4 = await prisma.subject.findUnique({ where: { subject_code: "BCA-402" } }); // Java
    const s5 = await prisma.subject.findUnique({ where: { subject_code: "BCA-403" } }); // CN

    // New subjects for Alice
    const sa1 = await prisma.subject.findUnique({ where: { subject_code: "BCA-501" } }); // AI
    const sa2 = await prisma.subject.findUnique({ where: { subject_code: "BCA-502" } }); // Cloud
    const sa3 = await prisma.subject.findUnique({ where: { subject_code: "BCA-503" } }); // Data Sci
    const sa4 = await prisma.subject.findUnique({ where: { subject_code: "BCA-504" } }); // Mobile
    const sa5 = await prisma.subject.findUnique({ where: { subject_code: "BCA-505" } }); // Cyber

    if (!s1 || !s2 || !s3 || !s4 || !s5 || !sa1 || !sa2 || !sa3 || !sa4 || !sa5) throw new Error("Could not find all BCA subjects.");

    const activePeriodId = bcaSectionA.batch.batch_semesters[0]?.period_id;
    if (!activePeriodId) throw new Error("BCA batch has no active semester period.");

    const assignments = [
      // Original assignments for other teachers
      { teacher_id: t2.teacher_id, subject_id: s2.subject_id, batch_id: bcaSectionA.batch_id, section_id: bcaSectionA.section_id, period_id: activePeriodId, role: "Primary Instructor", hours: 4, status: "ACTIVE" },
      { teacher_id: t3.teacher_id, subject_id: s3.subject_id, batch_id: bcaSectionA.batch_id, section_id: bcaSectionA.section_id, period_id: activePeriodId, role: "Primary Instructor", hours: 4, status: "ACTIVE" },
      { teacher_id: t4.teacher_id, subject_id: s4.subject_id, batch_id: bcaSectionA.batch_id, section_id: bcaSectionA.section_id, period_id: activePeriodId, role: "Primary Instructor", hours: 4, status: "ACTIVE" },
      { teacher_id: t5.teacher_id, subject_id: s5.subject_id, batch_id: bcaSectionA.batch_id, section_id: bcaSectionA.section_id, period_id: activePeriodId, role: "Primary Instructor", hours: 4, status: "ACTIVE" },
      
      // Alice gets the 5 new subjects (one for each class slot)
      { teacher_id: t1.teacher_id, subject_id: sa1.subject_id, batch_id: bcaSectionA.batch_id, section_id: bcaSectionA.section_id, period_id: activePeriodId, role: "Primary Instructor", hours: 5, status: "ACTIVE" },
      { teacher_id: t1.teacher_id, subject_id: sa2.subject_id, batch_id: bcaSectionA.batch_id, section_id: bcaSectionA.section_id, period_id: activePeriodId, role: "Primary Instructor", hours: 5, status: "ACTIVE" },
      { teacher_id: t1.teacher_id, subject_id: sa3.subject_id, batch_id: bcaSectionA.batch_id, section_id: bcaSectionA.section_id, period_id: activePeriodId, role: "Primary Instructor", hours: 5, status: "ACTIVE" },
      { teacher_id: t1.teacher_id, subject_id: sa4.subject_id, batch_id: bcaSectionA.batch_id, section_id: bcaSectionA.section_id, period_id: activePeriodId, role: "Primary Instructor", hours: 5, status: "ACTIVE" },
      { teacher_id: t1.teacher_id, subject_id: sa5.subject_id, batch_id: bcaSectionA.batch_id, section_id: bcaSectionA.section_id, period_id: activePeriodId, role: "Primary Instructor", hours: 5, status: "ACTIVE" },
    ];

    for (const assign of assignments) {
      await prisma.teacherSubjectAssignment.upsert({
        where: {
          teacher_id_subject_id_batch_id_section_id_period_id: {
            teacher_id: assign.teacher_id,
            subject_id: assign.subject_id,
            batch_id: assign.batch_id,
            section_id: assign.section_id,
            period_id: assign.period_id,
          }
        },
        update: {
          assigned_hours_per_week: assign.hours,
          assignment_role: assign.role,
          assignment_status: assign.status
        },
        create: {
          teacher_id: assign.teacher_id,
          subject_id: assign.subject_id,
          batch_id: assign.batch_id,
          section_id: assign.section_id,
          period_id: assign.period_id,
          assigned_hours_per_week: assign.hours,
          assignment_role: assign.role,
          assignment_status: assign.status
        }
      });
      console.log(`✅ Teacher Assigned to Subject ID ${assign.subject_id} for Section A (Status: ${assign.status}).`);
    }

  } catch (error) {
    console.error("❌ Error seeding teacher subject assignments:", error);
  }
}

async function seed_timetables() {
  try {
    console.log("🌱 Starting complex timetable seeding (BCA Section A)...");

    // 1. Fetch prerequisites
    const bcaSectionA = await prisma.section.findFirst({ where: { section_name: "BCA - Section A" } });
    const period = await prisma.academicPeriod.findFirst({ where: { is_active: true } });
    const room = await prisma.classroom.findUnique({ where: { room_number: "C-101" } });
    const slots = await prisma.timeSlot.findMany({
      where: { is_break: false },
      orderBy: { start_time: "asc" }
    });

    if (!bcaSectionA || !period || !room) {
      throw new Error("Missing prerequisite data for timetable seeding.");
    }

    // 2. Fetch ONLY the officially verified TeacherSubjectAssignments for this section
    //    This guarantees the timetable only uses teacher-subject pairs that are formally approved
    const assignments = await prisma.teacherSubjectAssignment.findMany({
      where: {
        section_id: bcaSectionA.section_id,
        period_id: period.period_id,
        assignment_status: "ACTIVE",
      },
      include: { teacher: true, subject: true },
    });

    if (assignments.length === 0) {
      throw new Error("No active teacher assignments found. Run seed_teacher_assignments() first.");
    }

    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

    // 3. For each day, each assignment gets a fixed, dedicated time slot
    //    Slot 1 → Assignment 0 (e.g. Alice teaches DBMS)
    //    Slot 2 → Assignment 1 (e.g. Charlie teaches OS)
    //    ...and so on. Same pattern every day.
    // 3. Define Alice's 5 subjects (from her assignments)
    const aliceAssignments = assignments.filter(a => a.teacher_id === assignments.find(x => x.teacher.employee_id === "EMP-SOCSE-001")?.teacher_id);
    const otherAssignments = assignments.filter(a => a.teacher_id !== aliceAssignments[0]?.teacher_id);

    for (let dayIndex = 0; dayIndex < days.length; dayIndex++) {
      const day = days[dayIndex];
      
      // Seed Alice's 5 slots (Slot 1 to 5) with rotation
      for (let slotIndex = 0; slotIndex < 5; slotIndex++) {
        // Rotate subjects each day: (slotIndex + dayIndex) % 5
        const assignment = aliceAssignments[(slotIndex + dayIndex) % aliceAssignments.length];
        const timeSlot = slots[slotIndex];

        if (!assignment || !timeSlot) continue;

        await prisma.timetable.upsert({
          where: {
            section_id_day_of_week_time_slot_id_period_id: {
              section_id: bcaSectionA.section_id,
              day_of_week: day,
              time_slot_id: timeSlot.time_slot_id,
              period_id: period.period_id,
            },
          },
          update: {
            teacher_id: assignment.teacher_id,
            subject_id: assignment.subject_id,
            classroom_id: room.classroom_id,
            timetable_status: "ACTIVE",
          },
          create: {
            teacher_id: assignment.teacher_id,
            subject_id: assignment.subject_id,
            batch_id: bcaSectionA.batch_id,
            section_id: bcaSectionA.section_id,
            classroom_id: room.classroom_id,
            period_id: period.period_id,
            day_of_week: day,
            time_slot_id: timeSlot.time_slot_id,
            timetable_status: "ACTIVE",
          },
        });
      }

      // Seed other teachers in Slot 6 and Slot 7 (Cycle the remaining 4 subjects)
      const extraSlots = slots.slice(5); // [Slot 6, Slot 7]
      for (let s = 0; s < extraSlots.length; s++) {
        const otherIndex = (dayIndex * extraSlots.length + s) % otherAssignments.length;
        const otherAssign = otherAssignments[otherIndex];
        const extraSlot = extraSlots[s];
        
        if (otherAssign && extraSlot) {
           await prisma.timetable.upsert({
            where: {
              section_id_day_of_week_time_slot_id_period_id: {
                section_id: bcaSectionA.section_id,
                day_of_week: day,
                time_slot_id: extraSlot.time_slot_id,
                period_id: period.period_id,
              },
            },
            update: {
              teacher_id: otherAssign.teacher_id,
              subject_id: otherAssign.subject_id,
              classroom_id: room.classroom_id,
              timetable_status: "ACTIVE",
            },
            create: {
              teacher_id: otherAssign.teacher_id,
              subject_id: otherAssign.subject_id,
              batch_id: bcaSectionA.batch_id,
              section_id: bcaSectionA.section_id,
              classroom_id: room.classroom_id,
              period_id: period.period_id,
              day_of_week: day,
              time_slot_id: extraSlot.time_slot_id,
              timetable_status: "ACTIVE",
            },
          });
        }
      }
      console.log(`✅ Timetable seeded for ${day} (Alice: 5 slots, Others: 2 slots).`);
    }
  } catch (error) {
    console.error("❌ Error seeding timetables:", error);
  }
}


async function seed_attendance_sessions() {
    try {
        console.log("🌱 Starting attendance session seeding (Past weeks)...");
        
        const timetables = await prisma.timetable.findMany({
            include: { time_slot: true }
        });

        // Generate sessions for the past 4 weeks (Mon-Fri)
        const today = new Date();
        const sessionDates: Date[] = [];
        
        for (let i = 0; i < 28; i++) {
            const date = new Date(today);
            date.setDate(today.getDate() - i);
            
            const dayOfWeek = date.getDay();
            // Normalize date to YYYY-MM-DD to avoid time issues with @db.Date
            const sessionDate = new Date(date.toISOString().split('T')[0]);
            sessionDates.push(sessionDate);
        }

        for (const date of sessionDates) {
            const dayName = date.toLocaleDateString("en-US", { weekday: "long" });
            const dayTimetables = timetables.filter(t => t.day_of_week === dayName);

            for (const t of dayTimetables) {
                await prisma.attendanceSession.upsert({
                    where: {
                        timetable_id_session_date: {
                            timetable_id: t.timetable_id,
                            session_date: date,
                        }
                    },
                    update: {},
                    create: {
                        timetable_id: t.timetable_id,
                        teacher_id: t.teacher_id,
                        subject_id: t.subject_id,
                        batch_id: t.batch_id,
                        section_id: t.section_id,
                        classroom_id: t.classroom_id,
                        session_date: date,
                        start_time: t.time_slot.start_time,
                        end_time: t.time_slot.end_time,
                        attendance_method: "MANUAL",
                        total_students: 120,
                    }
                });
            }
            console.log(`✅ Attendance Sessions created for ${dayName} (${date.toDateString()}).`);
        }
    } catch (error) {
        console.error("❌ Error seeding attendance sessions:", error);
    }
}

async function seed_attendance_records() {
    try {
        console.log("🌱 Starting attendance record seeding...");
        
        const sessions = await prisma.attendanceSession.findMany({
           include: { section: { include: { students: true } } }
        });

        for (const session of sessions) {
            const students = session.section.students;
            
            for (const student of students) {
                const isPresent = Math.random() < 0.85;

                await prisma.attendanceRecord.upsert({
                    where: {
                        session_id_student_id: {
                            session_id: session.session_id,
                            student_id: student.student_id
                        }
                    },
                    update: {
                        attendance_status: isPresent ? "PRESENT" : "ABSENT"
                    },
                    create: {
                        session_id: session.session_id,
                        student_id: student.student_id,
                        attendance_status: isPresent ? "PRESENT" : "ABSENT",
                        marked_by: "Alice Smith"
                    }
                });
            }
        }
        console.log("✅ Student attendance records finalized.");
    } catch (error) {
        console.error("❌ Error seeding attendance records:", error);
    }
}

async function seed_attendance_summaries() {
    try {
        console.log("🌱 Starting attendance summary calculation and seeding...");
        
        // 1. Get all students and subjects they are enrolled in
        const enrollments = await prisma.subjectEnrollment.findMany({
            where: { status: "ACTIVE" }
        });

        if (enrollments.length === 0) {
            console.log("⚠️ No active enrollments found. Skipping summaries.");
            return;
        }

        for (const enrollment of enrollments) {
            const { student_id, subject_id, period_id } = enrollment;

            // 2. Fetch the student's section to properly filter sessions
            const student = await prisma.student.findUnique({
                where: { student_id },
                select: { section_id: true }
            });

            if (!student) continue;

            // 3. Count total sessions for this subject, section, and period
            const totalClasses = await prisma.attendanceSession.count({
                where: {
                    subject_id,
                    section_id: student.section_id,
                    // If we have period_id in Timetable, we should ideally filter by it
                    // In our seed, sessions are linked to timetables which are linked to periods
                    timetable: {
                        period_id: period_id
                    }
                }
            });

            // 4. Count attended sessions (status = "PRESENT")
            const classesAttended = await prisma.attendanceRecord.count({
                where: {
                    student_id,
                    attendance_status: "PRESENT",
                    session: {
                        subject_id,
                        section_id: student.section_id,
                        timetable: {
                            period_id: period_id
                        }
                    }
                }
            });

            const classesMissed = totalClasses - classesAttended;
            const percentage = totalClasses > 0 ? (classesAttended / totalClasses) * 100 : 0;

            // 5. Upsert into AttendanceSummary
            await prisma.attendanceSummary.upsert({
                where: {
                    student_id_subject_id_period_id: {
                        student_id,
                        subject_id,
                        period_id
                    }
                },
                update: {
                    total_classes: totalClasses,
                    classes_attended: classesAttended,
                    classes_missed: classesMissed,
                    attendance_percentage: parseFloat(percentage.toFixed(2)),
                    last_updated: new Date()
                },
                create: {
                    student_id,
                    subject_id,
                    period_id,
                    total_classes: totalClasses,
                    classes_attended: classesAttended,
                    classes_missed: classesMissed,
                    attendance_percentage: parseFloat(percentage.toFixed(2)),
                    last_updated: new Date()
                }
            });
        }
        
        console.log(`✅ Attendance Summaries updated for ${enrollments.length} enrollments.`);
    } catch (error) {
        console.error("❌ Error seeding attendance summaries:", error);
    }
}

async function seed_users() {
  try {
    console.log("🌱 Starting user seeding (1 Student + 1 Teacher)...");

    // ----------------------------------------------------------
    // USER FOR STUDENT: Aarav Sharma
    // Email matches what seed_students() generates
    // ----------------------------------------------------------
    const aaravStudent = await prisma.student.findFirst({
      where: { first_name: "Aarav", last_name: "Sharma" }
    });

    if (!aaravStudent) {
      throw new Error("Student Aarav Sharma not found. Run seed_students() first.");
    }

    const studentUser = await prisma.user.upsert({
      where: { email: "aaravsharmabca24@rvu.edu.in" },
      update: { is_active: true },
      create: {
        email: "aaravsharmabca24@rvu.edu.in",
        password_hash: "hashed_temp_password_123", // Replace with bcrypt hash in production
        role: "STUDENT",
        is_active: true,
      }
    });

    // Link User → Student
    await prisma.student.update({
      where: { student_id: aaravStudent.student_id },
      data: { user_id: studentUser.user_id }
    });
    console.log(`✅ User created for Student: Aarav Sharma (Email: ${studentUser.email}, User ID: ${studentUser.user_id})`);

    // ----------------------------------------------------------
    // USER FOR TEACHER: Alice Smith
    // ----------------------------------------------------------
    const aliceTeacher = await prisma.teacher.findFirst({
      where: { first_name: "Alice", last_name: "Smith" }
    });

    if (!aliceTeacher) {
      throw new Error("Teacher Alice Smith not found. Run seed_teachers() first.");
    }

    const teacherUser = await prisma.user.upsert({
      where: { email: "alice.smith@college.edu" },
      update: { is_active: true },
      create: {
        email: "alice.smith@college.edu",
        password_hash: "hashed_temp_password_456", // Replace with bcrypt hash in production
        role: "TEACHER",
        is_active: true,
      }
    });

    // Link User → Teacher
    await prisma.teacher.update({
      where: { teacher_id: aliceTeacher.teacher_id },
      data: { user_id: teacherUser.user_id }
    });
    console.log(`✅ User created for Teacher: Alice Smith (Email: ${teacherUser.email}, User ID: ${teacherUser.user_id})`);

  } catch (error) {
    console.error("❌ Error seeding users:", error);
  }
}

// =============================================================================
// ADDITIONAL USERS SEED
// Adds 5 more student users + 1 more teacher user (Robert Brown).
// All 6 student users (including Aarav) share subjects with Alice (BCA-501 AI,
// BCA-503 Data Science). Robert Brown gets a subset of 3 student users enrolled
// in his assigned subject BCA-502 (Cloud Computing).
// Call AFTER seed_users() so Aarav already has a User record.
// =============================================================================
async function seed_additional_users() {
  try {
    console.log("🌱 Starting additional user seeding (5 Students + 1 Teacher)...");

    // ── Prerequisite lookups ──────────────────────────────────────────────────
    const activePeriod = await prisma.academicPeriod.findFirst({ where: { is_active: true } });
    if (!activePeriod) throw new Error("No active academic period found.");

    const bcaSectionA = await prisma.section.findFirst({
      where: { section_name: "BCA - Section A" },
      include: { batch: { include: { batch_semesters: { where: { status: "ACTIVE" } } } } },
    });
    if (!bcaSectionA) throw new Error("BCA Section A not found.");

    // Alice teaches BCA-501 (AI) and BCA-503 (Data Science) — shared with ALL 6 student users
    // Robert Brown teaches BCA-502 (Cloud Computing) — shared with only 3 student users
    const subjectAI        = await prisma.subject.findUnique({ where: { subject_code: "BCA-501" } });
    const subjectCloud     = await prisma.subject.findUnique({ where: { subject_code: "BCA-502" } });
    const subjectDataSci   = await prisma.subject.findUnique({ where: { subject_code: "BCA-503" } });
    if (!subjectAI || !subjectCloud || !subjectDataSci) {
      throw new Error("Required BCA-501/502/503 subjects not found. Ensure seed_subjects() ran.");
    }

    // ── 5 Additional Student Users ────────────────────────────────────────────
    // These students already exist in the DB (seeded by seed_students()).
    // We just need to create User accounts for them and link them.
    // Roll numbers follow pattern: 1RUA24BCA000X (globalCount from seed_students)
    const additionalStudents = [
      { firstName: "Ananya",  lastName: "Verma",     roll: "1RUA24BCA0002", email: "ananyavermabca24@rvu.edu.in",     password: "hashed_student_pw_002" },
      { firstName: "Ishaan",  lastName: "Gupta",     roll: "1RUA24BCA0003", email: "ishaanguptabca24@rvu.edu.in",     password: "hashed_student_pw_003" },
      { firstName: "Diya",    lastName: "Malhotra",  roll: "1RUA24BCA0004", email: "diyamalhotrabca24@rvu.edu.in",    password: "hashed_student_pw_004" },
      { firstName: "Reyansh", lastName: "Joshi",     roll: "1RUA24BCA0005", email: "reyanshjoshibca24@rvu.edu.in",    password: "hashed_student_pw_005" },
      { firstName: "Meera",   lastName: "Singhania", roll: "1RUA24BCA0006", email: "meerasinghaniabca24@rvu.edu.in",  password: "hashed_student_pw_006" },
    ];

    // Students who will ALSO share Robert's Cloud Computing subject (subset of 3)
    const robertsStudentRolls = new Set(["1RUA24BCA0002", "1RUA24BCA0004", "1RUA24BCA0005"]);

    for (const s of additionalStudents) {
      // 1. Find the existing student record
      const studentRecord = await prisma.student.findUnique({
        where: { university_roll_number: s.roll },
      });
      if (!studentRecord) {
        console.log(`⚠️ Student ${s.firstName} ${s.lastName} (${s.roll}) not found. Skipping.`);
        continue;
      }

      // 2. Create / retrieve user account
      const userRecord = await prisma.user.upsert({
        where: { email: s.email },
        update: { is_active: true },
        create: {
          email: s.email,
          password_hash: s.password,
          role: "STUDENT",
          is_active: true,
        },
      });

      // 3. Link User → Student
      await prisma.student.update({
        where: { student_id: studentRecord.student_id },
        data: { user_id: userRecord.user_id },
      });
      console.log(`✅ User created for Student: ${s.firstName} ${s.lastName} (${s.email})`);

      // 4. Enroll in Alice's subjects (BCA-501 AI + BCA-503 Data Science)
      //    These are sem-5 subjects; we enroll them directly in the active period.
      const periodId = activePeriod.period_id;
      for (const subj of [subjectAI, subjectDataSci]) {
        await prisma.subjectEnrollment.upsert({
          where: {
            student_id_subject_id_period_id: {
              student_id: studentRecord.student_id,
              subject_id: subj.subject_id,
              period_id: periodId,
            },
          },
          update: { status: "ACTIVE" },
          create: {
            student_id: studentRecord.student_id,
            subject_id: subj.subject_id,
            period_id: periodId,
            status: "ACTIVE",
          },
        });
      }
      console.log(`   ↳ Enrolled ${s.firstName} in BCA-501 (AI) & BCA-503 (Data Science) — Alice's subjects.`);

      // 5. Enroll subset of students in Robert's subject (BCA-502 Cloud Computing)
      if (robertsStudentRolls.has(s.roll)) {
        await prisma.subjectEnrollment.upsert({
          where: {
            student_id_subject_id_period_id: {
              student_id: studentRecord.student_id,
              subject_id: subjectCloud.subject_id,
              period_id: activePeriod.period_id,
            },
          },
          update: { status: "ACTIVE" },
          create: {
            student_id: studentRecord.student_id,
            subject_id: subjectCloud.subject_id,
            period_id: activePeriod.period_id,
            status: "ACTIVE",
          },
        });
        console.log(`   ↳ Also enrolled ${s.firstName} in BCA-502 (Cloud Computing) — Robert's subject.`);
      }
    }

    // ── Also enroll EXISTING Aarav Sharma in Alice's shared subjects ──────────
    // (Aarav was already a user from seed_users; now add him to sem-5 subjects too)
    const aarav = await prisma.student.findFirst({ where: { first_name: "Aarav", last_name: "Sharma" } });
    if (aarav) {
      for (const subj of [subjectAI, subjectDataSci]) {
        await prisma.subjectEnrollment.upsert({
          where: {
            student_id_subject_id_period_id: {
              student_id: aarav.student_id,
              subject_id: subj.subject_id,
              period_id: activePeriod.period_id,
            },
          },
          update: { status: "ACTIVE" },
          create: {
            student_id: aarav.student_id,
            subject_id: subj.subject_id,
            period_id: activePeriod.period_id,
            status: "ACTIVE",
          },
        });
      }
      console.log("✅ Aarav Sharma also enrolled in BCA-501 (AI) & BCA-503 (Data Science) — Alice's subjects.");
    }

    // ── Additional Teacher User: Robert Brown ─────────────────────────────────
    const robertTeacher = await prisma.teacher.findUnique({ where: { employee_id: "EMP-SOCSE-002" } });
    if (!robertTeacher) throw new Error("Teacher Robert Brown (EMP-SOCSE-002) not found. Run seed_teachers() first.");

    const robertUser = await prisma.user.upsert({
      where: { email: "robert.brown@college.edu" },
      update: { is_active: true },
      create: {
        email: "robert.brown@college.edu",
        password_hash: "hashed_teacher_pw_robert", // Replace with bcrypt hash in production
        role: "TEACHER",
        is_active: true,
      },
    });

    // Link User → Teacher
    await prisma.teacher.update({
      where: { teacher_id: robertTeacher.teacher_id },
      data: { user_id: robertUser.user_id },
    });
    console.log(`✅ User created for Teacher: Robert Brown (Email: ${robertUser.email}, User ID: ${robertUser.user_id})`);

    // ── Teacher Subject Assignment: Robert → BCA-502 (Cloud Computing) ────────
    await prisma.teacherSubjectAssignment.upsert({
      where: {
        teacher_id_subject_id_batch_id_section_id_period_id: {
          teacher_id: robertTeacher.teacher_id,
          subject_id: subjectCloud.subject_id,
          batch_id: bcaSectionA.batch_id,
          section_id: bcaSectionA.section_id,
          period_id: activePeriod.period_id,
        },
      },
      update: {
        assigned_hours_per_week: 4,
        assignment_role: "Primary Instructor",
        assignment_status: "ACTIVE",
      },
      create: {
        teacher_id: robertTeacher.teacher_id,
        subject_id: subjectCloud.subject_id,
        batch_id: bcaSectionA.batch_id,
        section_id: bcaSectionA.section_id,
        period_id: activePeriod.period_id,
        assigned_hours_per_week: 4,
        assignment_role: "Primary Instructor",
        assignment_status: "ACTIVE",
      },
    });
    console.log("✅ Robert Brown assigned to BCA-502 (Cloud Computing) for BCA Section A.");

    console.log("\n📋 Summary of additional users:");
    console.log("   👩‍🎓 Student users: Ananya, Ishaan, Diya, Reyansh, Meera (+ existing Aarav)");
    console.log("   📚 All 6 share: BCA-501 AI & BCA-503 Data Science → with Alice Smith");
    console.log("   📚 Ananya, Diya, Reyansh also share: BCA-502 Cloud Computing → with Robert Brown");
    console.log("   👨‍🏫 Teacher user: Robert Brown (robert.brown@college.edu)");

  } catch (error) {
    console.error("❌ Error seeding additional users:", error);
  }
}

async function main() {
  try {
    await seed_classrooms();
    await seed_time_slots();
    await seed_academic_periods();
    await seed_departments();
    await seed_teachers();
    await seed_programs();
    await seed_subjects();
    await seed_batches();
    await seed_sections();
    await seed_students();
    await seed_guardians();
    await seed_subject_enrollments();
    await seed_teacher_assignments();
    await seed_timetables();
    await seed_attendance_sessions();
    await seed_attendance_records();
    await seed_attendance_summaries();
    await seed_users();
    await seed_additional_users();
    console.log("✨ All seed data finished successfully.");
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

