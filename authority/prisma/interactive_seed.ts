import { prisma } from "../lib/prisma";
import readline from "node:readline";
import { generateSnowflake } from "../lib/snowflake";
import { hash } from "bcryptjs";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function getBulkJson(tableName: string, mockData: any): Promise<any[]> {
  console.log(`\n================================================================`);
  console.log(`Table: ${tableName}`);
  console.log(`================================================================`);
  console.log(`Mock Representation (Provide an array of these objects):`);
  console.log(JSON.stringify([mockData], null, 2));
  console.log(`\n📥 Paste your bulk JSON data for ${tableName} below.`);
  console.log(`⚠️  CRITICAL: When finished, type 'DONE' on a new line and press Enter.`);

  let input = "";
  return new Promise((resolve) => {
    const onLine = (line: string) => {
      const trimmed = line.trim().toUpperCase();
      if (trimmed === "DONE") {
        rl.removeListener("line", onLine);
        try {
          if (!input.trim()) {
            console.log(`ℹ️  No data provided for ${tableName}. Skipping.`);
            resolve([]);
            return;
          }
          const data = JSON.parse(input);
          if (!Array.isArray(data)) {
            console.error("❌ Error: Input must be a JSON array.");
            resolve([]);
          } else {
            resolve(data);
          }
        } catch (error: any) {
          console.error(`❌ Error parsing JSON: ${error.message}`);
          console.log("💡 Tip: Ensure you pasted a valid JSON array.");
          resolve([]);
        }
      } else {
        input += line + "\n";
      }
    };
    rl.on("line", onLine);
  });
}

async function askQuestion(query: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      resolve(answer.trim().toLowerCase());
    });
  });
}

async function main() {
  try {
    console.log("🚀 Starting Corrected Academic Pipeline Seeding...");
    
    const mode = await askQuestion("\nEnter mode (1: Progressive | 2: Direct): ");
    let fastForwardMode = mode === "2";
    let foundFirstEmpty = false;

    const tableSequence = [
      { name: "Classroom", model: prisma.classroom },
      { name: "TimeSlot", model: prisma.timeSlot },
      { name: "AcademicPeriod", model: prisma.academicPeriod },
      { name: "Department", model: prisma.department },
      { name: "Teacher", model: prisma.teacher },
      { name: "Program", model: prisma.program },
      { name: "Subject", model: prisma.subject },
      { name: "Batch", model: prisma.batch },
      { name: "Section", model: prisma.section },
      { name: "User", model: prisma.user },
      { name: "Student", model: prisma.student },
      { name: "Guardian", model: prisma.guardian },
      { name: "TeacherSubjectAssignment", model: prisma.teacherSubjectAssignment },
      { name: "SubjectEnrollment", model: prisma.subjectEnrollment },
      { name: "Timetable", model: prisma.timetable },
      { name: "AttendanceSession", model: prisma.attendanceSession },
      { name: "AttendanceRecord", model: prisma.attendanceRecord },
      { name: "Exam", model: prisma.exam },
      { name: "ExamResult", model: prisma.examResult }
    ];

    for (const table of tableSequence) {
      const count = await table.model.count();
      
      if (fastForwardMode && !foundFirstEmpty) {
        if (count > 0) {
          console.log(`⏭️  Skipping '${table.name}' (${count} records exist).`);
          continue;
        } else {
          console.log(`🎯 Stopped jump at empty table: '${table.name}'.`);
          foundFirstEmpty = true;
        }
      }

      console.log(`\n----------------------------------------------------------------`);
      console.log(`📊 Table: ${table.name} | Status: ${count > 0 ? `${count} records found` : "EMPTY"}`);
      
      const answer = await askQuestion(`❓ Seed '${table.name}'? (y/n): `);
      if (answer !== "y") continue;

      let data: any[] = [];
      
      switch (table.name) {
        case "Classroom":
          data = await getBulkJson("Classroom", { room_number: "C-101", building_name: "C Block", floor_number: 1, seating_capacity: 60, room_type: "LECTURE", status: "ACTIVE" });
          for (const item of data) {
            try {
              await prisma.classroom.upsert({ where: { room_number: item.room_number }, update: item, create: { ...item, classroom_id: generateSnowflake() } });
              console.log(`✅ Classroom ${item.room_number} upserted.`);
            } catch (e: any) { console.error(`❌ Error in Classroom ${item.room_number}: ${e.message}`); }
          }
          break;

        case "TimeSlot":
          data = await getBulkJson("TimeSlot", { slot_name: "Slot 1", start_time: "09:00:00", end_time: "10:00:00", day_of_week: "MONDAY", is_break: false });
          for (const item of data) {
            try {
              const start = new Date(`1970-01-01T${item.start_time}Z`);
              const end = new Date(`1970-01-01T${item.end_time}Z`);
              await prisma.timeSlot.upsert({ where: { slot_name: item.slot_name }, update: { ...item, start_time: start, end_time: end }, create: { ...item, time_slot_id: generateSnowflake(), start_time: start, end_time: end } });
              console.log(`✅ TimeSlot ${item.slot_name} upserted.`);
            } catch (e: any) { console.error(`❌ Error in TimeSlot ${item.slot_name}: ${e.message}`); }
          }
          break;

        case "AcademicPeriod":
          data = await getBulkJson("AcademicPeriod", { name: "ODD 2024", academic_year: "2024-25", term_type: "ODD", start_date: "2024-08-01", end_date: "2024-12-31", status: "ACTIVE" });
          for (const item of data) {
            try {
              const start = new Date(item.start_date);
              const end = new Date(item.end_date);
              await prisma.academicPeriod.upsert({ where: { name_academic_year: { name: item.name, academic_year: item.academic_year } }, update: { ...item, start_date: start, end_date: end }, create: { ...item, period_id: generateSnowflake(), start_date: start, end_date: end } });
              console.log(`✅ AcademicPeriod ${item.name} upserted.`);
            } catch (e: any) { console.error(`❌ Error in AcademicPeriod ${item.name}: ${e.message}`); }
          }
          break;

        case "Department":
          data = await getBulkJson("Department", { department_code: "SOCSE", department_name: "Computer Science", office_location: "Block A", status: "ACTIVE" });
          for (const item of data) {
            try {
              await prisma.department.upsert({ where: { department_code: item.department_code }, update: item, create: { ...item, department_id: generateSnowflake() } });
              console.log(`✅ Department ${item.department_code} upserted.`);
            } catch (e: any) { console.error(`❌ Error in Department ${item.department_code}: ${e.message}`); }
          }
          break;

        case "Teacher":
          data = await getBulkJson("Teacher", { employee_id: "EMP-001", first_name: "John", department_id: "1", designation: "Asst Prof", joining_date: "2020-01-01" });
          for (const item of data) {
            try {
              const teacherData = { ...item, department_id: BigInt(item.department_id), joining_date: item.joining_date ? new Date(item.joining_date) : undefined, date_of_birth: item.date_of_birth ? new Date(item.date_of_birth) : undefined };
              await prisma.teacher.upsert({ where: { employee_id: item.employee_id }, update: teacherData, create: { ...teacherData, teacher_id: generateSnowflake() } });
              console.log(`✅ Teacher ${item.employee_id} upserted.`);
            } catch (e: any) { console.error(`❌ Error in Teacher ${item.employee_id}: ${e.message}`); }
          }
          break;

        case "Program":
          data = await getBulkJson("Program", { program_code: "BCA", program_name: "BCA", department_id: "1", program_type: "UG", status: "ACTIVE" });
          for (const item of data) {
            try {
              await prisma.program.upsert({ where: { program_code: item.program_code }, update: { ...item, department_id: BigInt(item.department_id) }, create: { ...item, program_id: generateSnowflake(), department_id: BigInt(item.department_id) } });
              console.log(`✅ Program ${item.program_code} upserted.`);
            } catch (e: any) { console.error(`❌ Error in Program ${item.program_code}: ${e.message}`); }
          }
          break;

        case "Subject":
          data = await getBulkJson("Subject", { subject_code: "BCA-101", subject_name: "C Prog", program_id: "1", semester_number: 1, subject_type: "CORE", credit_hours: 4 });
          for (const item of data) {
            try {
              await prisma.subject.upsert({ where: { subject_code: item.subject_code }, update: { ...item, program_id: BigInt(item.program_id) }, create: { ...item, subject_id: generateSnowflake(), program_id: BigInt(item.program_id) } });
              console.log(`✅ Subject ${item.subject_code} upserted.`);
            } catch (e: any) { console.error(`❌ Error in Subject ${item.subject_code}: ${e.message}`); }
          }
          break;

        case "Batch":
          data = await getBulkJson("Batch", { batch_name: "2024-27", program_id: "1", period_id: "1", admission_year: 2024, status: "ACTIVE" });
          for (const item of data) {
            try {
              const bData = { ...item, program_id: BigInt(item.program_id), period_id: BigInt(item.period_id) };
              const ex = await prisma.batch.findFirst({ where: { batch_name: item.batch_name, program_id: bData.program_id } });
              if (ex) await prisma.batch.update({ where: { batch_id: ex.batch_id }, data: bData });
              else await prisma.batch.create({ data: { ...bData, batch_id: generateSnowflake() } });
              console.log(`✅ Batch ${item.batch_name} processed.`);
            } catch (e: any) { console.error(`❌ Error in Batch ${item.batch_name}: ${e.message}`); }
          }
          break;

        case "Section":
          data = await getBulkJson("Section", { section_name: "Sec A", batch_id: "1", classroom_id: "1", section_strength: 60, status: "ACTIVE" });
          for (const item of data) {
            try {
              const sData = { ...item, batch_id: BigInt(item.batch_id), classroom_id: BigInt(item.classroom_id) };
              const ex = await prisma.section.findFirst({ where: { section_name: item.section_name, batch_id: sData.batch_id } });
              if (ex) await prisma.section.update({ where: { section_id: ex.section_id }, data: sData });
              else await prisma.section.create({ data: { ...sData, section_id: generateSnowflake() } });
              console.log(`✅ Section ${item.section_name} processed.`);
            } catch (e: any) { console.error(`❌ Error in Section ${item.section_name}: ${e.message}`); }
          }
          break;

        case "User":
          data = await getBulkJson("User", { account_identifier: "1RUA24BCA0001", email: "std@edu.com", password: "pwd", role: "STUDENT", is_active: true });
          for (const item of data) {
            try {
              if (item.password) { item.password_hash = await hash(item.password, 10); delete item.password; }
              await prisma.user.upsert({ where: { email: item.email }, update: item, create: { ...item, user_id: generateSnowflake() } });
              console.log(`✅ User account ${item.email} upserted.`);
            } catch (e: any) { console.error(`❌ Error in User ${item.email}: ${e.message}`); }
          }
          break;

        case "Student":
          data = await getBulkJson("Student", { university_roll_number: "1RUA24BCA0001", first_name: "Aarav", batch_id: "1", section_id: "1", program_id: "1", date_of_birth: "2005-01-01" });
          for (const item of data) {
            try {
              const sData = { ...item, batch_id: BigInt(item.batch_id), section_id: BigInt(item.section_id), program_id: BigInt(item.program_id), date_of_birth: item.date_of_birth ? new Date(item.date_of_birth) : undefined, admission_date: item.admission_date ? new Date(item.admission_date) : undefined };
              await prisma.student.upsert({ where: { university_roll_number: item.university_roll_number }, update: sData, create: { ...sData, student_id: generateSnowflake() } });
              console.log(`✅ Student ${item.university_roll_number} upserted.`);
            } catch (e: any) { console.error(`❌ Error in Student ${item.university_roll_number}: ${e.message}`); }
          }
          break;

        case "Guardian":
          data = await getBulkJson("Guardian", { student_id: "1", guardian_name: "Ramesh Sharma", relation_type: "FATHER", phone_number: "9988776655", email: "ramesh@email.com", address: "123 Street", city: "Bangalore", state: "KA", postal_code: "560001" });
          for (const item of data) {
            try {
              const gData = { ...item, student_id: BigInt(item.student_id) };
              await prisma.guardian.upsert({ 
                where: { student_id: gData.student_id }, 
                update: gData, 
                create: { ...gData, guardian_id: generateSnowflake() }
              });
              console.log(`✅ Guardian for student ${item.student_id} upserted.`);
            } catch (e: any) { console.error(`❌ Error in Guardian: ${e.message}`); }
          }
          break;

        case "TeacherSubjectAssignment":
          data = await getBulkJson("TeacherSubjectAssignment", { teacher_id: "1", subject_id: "1", batch_id: "1", section_id: "1", period_id: "1", assignment_status: "ACTIVE" });
          for (const item of data) {
            try {
              const tData = { 
                teacher_id: BigInt(item.teacher_id), 
                subject_id: BigInt(item.subject_id), 
                batch_id: BigInt(item.batch_id), 
                section_id: BigInt(item.section_id), 
                period_id: BigInt(item.period_id), 
                assignment_status: item.assignment_status || "ACTIVE" 
              };
              await prisma.teacherSubjectAssignment.upsert({ 
                where: { teacher_id_subject_id_batch_id_section_id_period_id: {
                  teacher_id: tData.teacher_id,
                  subject_id: tData.subject_id,
                  batch_id: tData.batch_id,
                  section_id: tData.section_id,
                  period_id: tData.period_id
                } }, 
                update: tData, 
                create: { ...tData, assignment_id: generateSnowflake() } 
              });
              console.log(`✅ Assignment for Teacher ${item.teacher_id} upserted.`);
            } catch (e: any) { console.error(`❌ Error in Assignment: ${e.message}`); }
          }
          break;

        case "SubjectEnrollment":
          data = await getBulkJson("SubjectEnrollment", { student_id: "1", subject_id: "1", period_id: "1", status: "ACTIVE" });
          for (const item of data) {
            try {
              const eData = { 
                student_id: BigInt(item.student_id), 
                subject_id: BigInt(item.subject_id), 
                period_id: BigInt(item.period_id), 
                status: item.status || "ACTIVE" 
              };
              await prisma.subjectEnrollment.upsert({ 
                where: { student_id_subject_id_period_id: { student_id: eData.student_id, subject_id: eData.subject_id, period_id: eData.period_id } }, 
                update: eData, 
                create: { ...eData, enrollment_id: generateSnowflake() } 
              });
              console.log(`✅ Enrollment for student ${item.student_id} upserted.`);
            } catch (e: any) { console.error(`❌ Error in Enrollment: ${e.message}`); }
          }
          break;

        case "Timetable":
          data = await getBulkJson("Timetable", { teacher_id: "1", subject_id: "1", batch_id: "1", section_id: "1", classroom_id: "1", period_id: "1", day_of_week: "MONDAY", time_slot_id: "1", timetable_status: "ACTIVE" });
          for (const item of data) {
            try {
              const tData = { 
                teacher_id: BigInt(item.teacher_id), 
                subject_id: BigInt(item.subject_id), 
                batch_id: BigInt(item.batch_id), 
                section_id: BigInt(item.section_id), 
                classroom_id: BigInt(item.classroom_id), 
                period_id: BigInt(item.period_id), 
                day_of_week: item.day_of_week, 
                time_slot_id: BigInt(item.time_slot_id), 
                timetable_status: item.timetable_status || "ACTIVE" 
              };
              await prisma.timetable.create({ data: { ...tData, timetable_id: generateSnowflake() } });
              console.log(`✅ Timetable entry for ${item.day_of_week} created.`);
            } catch (e: any) { console.error(`❌ Error in Timetable: ${e.message}`); }
          }
          break;

        case "AttendanceSession":
          data = await getBulkJson("AttendanceSession", { timetable_id: "1", teacher_id: "1", subject_id: "1", batch_id: "1", section_id: "1", classroom_id: "1", session_date: "2024-09-01", start_time: "09:00:00", end_time: "10:00:00" });
          for (const item of data) {
            try {
              const aData = { 
                timetable_id: BigInt(item.timetable_id), 
                teacher_id: BigInt(item.teacher_id), 
                subject_id: BigInt(item.subject_id), 
                batch_id: BigInt(item.batch_id), 
                section_id: BigInt(item.section_id), 
                classroom_id: BigInt(item.classroom_id), 
                session_date: new Date(item.session_date),
                start_time: item.start_time ? new Date(`1970-01-01T${item.start_time}Z`) : undefined,
                end_time: item.end_time ? new Date(`1970-01-01T${item.end_time}Z`) : undefined
              };
              await prisma.attendanceSession.create({ data: { ...aData, session_id: generateSnowflake() } });
              console.log(`✅ Attendance Session for ${item.session_date} created.`);
            } catch (e: any) { console.error(`❌ Error in AttendanceSession: ${e.message}`); }
          }
          break;

        case "AttendanceRecord":
          data = await getBulkJson("AttendanceRecord", { session_id: "1", student_id: "1", attendance_status: "PRESENT", remarks: "On time" });
          for (const item of data) {
            try {
              const rData = { 
                session_id: BigInt(item.session_id), 
                student_id: BigInt(item.student_id), 
                attendance_status: item.attendance_status || "PRESENT", 
                remarks: item.remarks 
              };
              await prisma.attendanceRecord.upsert({ 
                where: { session_id_student_id: { session_id: rData.session_id, student_id: rData.student_id } }, 
                update: rData, 
                create: { ...rData, attendance_id: generateSnowflake() } 
              });
              console.log(`✅ Attendance record for student ${item.student_id} upserted.`);
            } catch (e: any) { console.error(`❌ Error in AttendanceRecord: ${e.message}`); }
          }
          break;

        case "Exam":
          data = await getBulkJson("Exam", { subject_id: "1", batch_id: "1", period_id: "1", exam_type: "MID_TERM", exam_date: "2024-10-15", total_marks: 100, passing_marks: 40, status: "OPEN" });
          for (const item of data) {
            try {
              const exData = { 
                subject_id: BigInt(item.subject_id), 
                batch_id: BigInt(item.batch_id), 
                period_id: BigInt(item.period_id), 
                exam_type: item.exam_type, 
                exam_date: new Date(item.exam_date), 
                total_marks: Number(item.total_marks), 
                passing_marks: Number(item.passing_marks), 
                status: item.status || "OPEN" 
              };
              await prisma.exam.upsert({
                where: { subject_id_batch_id_period_id_exam_type: {
                  subject_id: exData.subject_id,
                  batch_id: exData.batch_id,
                  period_id: exData.period_id,
                  exam_type: exData.exam_type
                }},
                update: exData,
                create: { ...exData, exam_id: generateSnowflake() }
              });
              console.log(`✅ Exam ${item.exam_type} processed.`);
            } catch (e: any) { console.error(`❌ Error in Exam: ${e.message}`); }
          }
          break;

        case "ExamResult":
          data = await getBulkJson("ExamResult", { exam_id: "1", student_id: "1", marks_obtained: 85, is_absent: false, remarks: "Good" });
          for (const item of data) {
            try {
              const resData = { 
                exam_id: BigInt(item.exam_id), 
                student_id: BigInt(item.student_id), 
                marks_obtained: Number(item.marks_obtained), 
                is_absent: item.is_absent || false, 
                remarks: item.remarks 
              };
              await prisma.examResult.upsert({ 
                where: { exam_id_student_id: { exam_id: resData.exam_id, student_id: resData.student_id } }, 
                update: resData, 
                create: { ...resData, result_id: generateSnowflake() } 
              });
              console.log(`✅ Exam Result for student ${item.student_id} upserted.`);
            } catch (e: any) { console.error(`❌ Error in ExamResult: ${e.message}`); }
          }
          break;
      }
    }
    console.log("\n✨ Seeding process completed successfully!");
  } catch (error) { console.error("\n❌ Seeding failed:", error); } finally { await prisma.$disconnect(); rl.close(); }
}
main();
