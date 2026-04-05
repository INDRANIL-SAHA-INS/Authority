-- CreateTable
CREATE TABLE "departments" (
    "department_id" BIGSERIAL NOT NULL,
    "department_code" TEXT,
    "department_name" TEXT,
    "department_head_id" BIGINT,
    "office_location" TEXT,
    "contact_email" TEXT,
    "contact_phone" TEXT,
    "established_year" INTEGER,
    "status" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("department_id")
);

-- CreateTable
CREATE TABLE "classrooms" (
    "classroom_id" BIGSERIAL NOT NULL,
    "room_number" TEXT,
    "building_name" TEXT,
    "floor_number" INTEGER,
    "seating_capacity" INTEGER,
    "room_type" TEXT,
    "projector_available" BOOLEAN,
    "smart_board_available" BOOLEAN,
    "status" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "classrooms_pkey" PRIMARY KEY ("classroom_id")
);

-- CreateTable
CREATE TABLE "time_slots" (
    "time_slot_id" BIGSERIAL NOT NULL,
    "slot_name" TEXT,
    "start_time" TIME,
    "end_time" TIME,
    "duration_minutes" INTEGER,
    "is_break" BOOLEAN,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "time_slots_pkey" PRIMARY KEY ("time_slot_id")
);

-- CreateTable
CREATE TABLE "subjects" (
    "subject_id" BIGSERIAL NOT NULL,
    "subject_code" TEXT,
    "subject_name" TEXT,
    "department_id" BIGINT NOT NULL,
    "credits" INTEGER,
    "subject_type" TEXT,
    "lecture_hours" INTEGER,
    "tutorial_hours" INTEGER,
    "practical_hours" INTEGER,
    "syllabus_version" TEXT,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subjects_pkey" PRIMARY KEY ("subject_id")
);

-- CreateTable
CREATE TABLE "teachers" (
    "teacher_id" BIGSERIAL NOT NULL,
    "employee_id" TEXT,
    "first_name" TEXT,
    "last_name" TEXT,
    "gender" TEXT,
    "date_of_birth" DATE,
    "department_id" BIGINT NOT NULL,
    "designation" TEXT,
    "qualification" TEXT,
    "specialization" TEXT,
    "joining_date" DATE,
    "experience_years" INTEGER,
    "phone_number" TEXT,
    "email" TEXT,
    "office_room" TEXT,
    "employment_type" TEXT,
    "salary_grade" TEXT,
    "status" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teachers_pkey" PRIMARY KEY ("teacher_id")
);

-- CreateTable
CREATE TABLE "programs" (
    "program_id" BIGSERIAL NOT NULL,
    "department_id" BIGINT NOT NULL,
    "program_code" TEXT,
    "program_name" TEXT,
    "degree_type" TEXT,
    "program_duration_years" INTEGER,
    "total_semesters" INTEGER,
    "description" TEXT,
    "accreditation_body" TEXT,
    "program_coordinator_id" BIGINT,
    "status" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "programs_pkey" PRIMARY KEY ("program_id")
);

-- CreateTable
CREATE TABLE "batches" (
    "batch_id" BIGSERIAL NOT NULL,
    "program_id" BIGINT NOT NULL,
    "admission_year" INTEGER,
    "expected_graduation_year" INTEGER,
    "batch_name" TEXT,
    "total_students" INTEGER,
    "batch_advisor_id" BIGINT,
    "academic_regulation" TEXT,
    "status" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "batches_pkey" PRIMARY KEY ("batch_id")
);

-- CreateTable
CREATE TABLE "sections" (
    "section_id" BIGSERIAL NOT NULL,
    "batch_id" BIGINT NOT NULL,
    "section_name" TEXT,
    "classroom_id" BIGINT,
    "section_strength" INTEGER,
    "class_teacher_id" BIGINT,
    "floor_number" INTEGER,
    "building_name" TEXT,
    "status" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sections_pkey" PRIMARY KEY ("section_id")
);

-- CreateTable
CREATE TABLE "students" (
    "student_id" BIGSERIAL NOT NULL,
    "university_roll_number" TEXT,
    "registration_number" TEXT,
    "first_name" TEXT,
    "last_name" TEXT,
    "gender" TEXT,
    "date_of_birth" DATE,
    "batch_id" BIGINT NOT NULL,
    "section_id" BIGINT NOT NULL,
    "program_id" BIGINT NOT NULL,
    "admission_date" DATE,
    "current_semester" INTEGER,
    "student_status" TEXT,
    "email" TEXT,
    "phone_number" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT,
    "postal_code" TEXT,
    "blood_group" TEXT,
    "nationality" TEXT,
    "category" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "students_pkey" PRIMARY KEY ("student_id")
);

-- CreateTable
CREATE TABLE "guardians" (
    "guardian_id" BIGSERIAL NOT NULL,
    "student_id" BIGINT NOT NULL,
    "father_name" TEXT,
    "mother_name" TEXT,
    "guardian_name" TEXT,
    "relation_type" TEXT,
    "phone_number" TEXT,
    "alternate_phone" TEXT,
    "email" TEXT,
    "occupation" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postal_code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guardians_pkey" PRIMARY KEY ("guardian_id")
);

-- CreateTable
CREATE TABLE "program_semester_subjects" (
    "program_semester_subject_id" BIGSERIAL NOT NULL,
    "program_id" BIGINT NOT NULL,
    "semester_number" INTEGER,
    "subject_id" BIGINT NOT NULL,
    "subject_order" INTEGER,
    "subject_category" TEXT,
    "credits" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "program_semester_subjects_pkey" PRIMARY KEY ("program_semester_subject_id")
);

-- CreateTable
CREATE TABLE "teacher_subject_assignments" (
    "assignment_id" BIGSERIAL NOT NULL,
    "teacher_id" BIGINT NOT NULL,
    "subject_id" BIGINT NOT NULL,
    "batch_id" BIGINT NOT NULL,
    "section_id" BIGINT NOT NULL,
    "semester_number" INTEGER,
    "academic_year" TEXT,
    "assigned_hours_per_week" INTEGER,
    "assignment_role" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teacher_subject_assignments_pkey" PRIMARY KEY ("assignment_id")
);

-- CreateTable
CREATE TABLE "timetables" (
    "timetable_id" BIGSERIAL NOT NULL,
    "teacher_id" BIGINT NOT NULL,
    "subject_id" BIGINT NOT NULL,
    "batch_id" BIGINT NOT NULL,
    "section_id" BIGINT NOT NULL,
    "classroom_id" BIGINT NOT NULL,
    "semester_number" INTEGER,
    "day_of_week" TEXT,
    "time_slot_id" BIGINT NOT NULL,
    "academic_year" TEXT,
    "timetable_status" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "timetables_pkey" PRIMARY KEY ("timetable_id")
);

-- CreateTable
CREATE TABLE "face_data" (
    "face_id" BIGSERIAL NOT NULL,
    "student_id" BIGINT NOT NULL,
    "image_path" TEXT,
    "face_encoding" TEXT,
    "dataset_version" TEXT,
    "capture_date" DATE,
    "image_quality_score" DOUBLE PRECISION,
    "status" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "face_data_pkey" PRIMARY KEY ("face_id")
);

-- CreateTable
CREATE TABLE "attendance_sessions" (
    "session_id" BIGSERIAL NOT NULL,
    "timetable_id" BIGINT NOT NULL,
    "teacher_id" BIGINT NOT NULL,
    "subject_id" BIGINT NOT NULL,
    "batch_id" BIGINT NOT NULL,
    "section_id" BIGINT NOT NULL,
    "classroom_id" BIGINT NOT NULL,
    "session_date" DATE,
    "start_time" TIME,
    "end_time" TIME,
    "attendance_method" TEXT,
    "total_students" INTEGER,
    "present_count" INTEGER,
    "absent_count" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_sessions_pkey" PRIMARY KEY ("session_id")
);

-- CreateTable
CREATE TABLE "attendance_records" (
    "attendance_id" BIGSERIAL NOT NULL,
    "session_id" BIGINT NOT NULL,
    "student_id" BIGINT NOT NULL,
    "attendance_status" TEXT,
    "detection_confidence" DOUBLE PRECISION,
    "capture_time" TIMESTAMP(3),
    "marked_by" TEXT,
    "remarks" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("attendance_id")
);

-- CreateTable
CREATE TABLE "attendance_summary" (
    "summary_id" BIGSERIAL NOT NULL,
    "student_id" BIGINT NOT NULL,
    "subject_id" BIGINT NOT NULL,
    "semester_number" INTEGER,
    "total_classes" INTEGER,
    "classes_attended" INTEGER,
    "classes_missed" INTEGER,
    "attendance_percentage" DOUBLE PRECISION,
    "last_updated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_summary_pkey" PRIMARY KEY ("summary_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "departments_department_head_id_key" ON "departments"("department_head_id");

-- CreateIndex
CREATE UNIQUE INDEX "departments_department_code_key" ON "departments"("department_code");

-- CreateIndex
CREATE INDEX "subjects_department_id_idx" ON "subjects"("department_id");

-- CreateIndex
CREATE UNIQUE INDEX "subjects_subject_code_key" ON "subjects"("subject_code");

-- CreateIndex
CREATE INDEX "teachers_department_id_idx" ON "teachers"("department_id");

-- CreateIndex
CREATE INDEX "teachers_status_idx" ON "teachers"("status");

-- CreateIndex
CREATE UNIQUE INDEX "teachers_employee_id_key" ON "teachers"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "teachers_email_key" ON "teachers"("email");

-- CreateIndex
CREATE INDEX "programs_department_id_idx" ON "programs"("department_id");

-- CreateIndex
CREATE INDEX "programs_status_idx" ON "programs"("status");

-- CreateIndex
CREATE UNIQUE INDEX "programs_program_code_key" ON "programs"("program_code");

-- CreateIndex
CREATE INDEX "batches_program_id_idx" ON "batches"("program_id");

-- CreateIndex
CREATE INDEX "batches_admission_year_idx" ON "batches"("admission_year");

-- CreateIndex
CREATE INDEX "batches_status_idx" ON "batches"("status");

-- CreateIndex
CREATE INDEX "sections_batch_id_idx" ON "sections"("batch_id");

-- CreateIndex
CREATE INDEX "sections_classroom_id_idx" ON "sections"("classroom_id");

-- CreateIndex
CREATE INDEX "students_batch_id_idx" ON "students"("batch_id");

-- CreateIndex
CREATE INDEX "students_section_id_idx" ON "students"("section_id");

-- CreateIndex
CREATE INDEX "students_program_id_idx" ON "students"("program_id");

-- CreateIndex
CREATE INDEX "students_student_status_idx" ON "students"("student_status");

-- CreateIndex
CREATE INDEX "students_email_idx" ON "students"("email");

-- CreateIndex
CREATE UNIQUE INDEX "students_university_roll_number_key" ON "students"("university_roll_number");

-- CreateIndex
CREATE UNIQUE INDEX "students_registration_number_key" ON "students"("registration_number");

-- CreateIndex
CREATE UNIQUE INDEX "guardians_student_id_key" ON "guardians"("student_id");

-- CreateIndex
CREATE INDEX "program_semester_subjects_program_id_semester_number_idx" ON "program_semester_subjects"("program_id", "semester_number");

-- CreateIndex
CREATE UNIQUE INDEX "program_semester_subjects_program_id_semester_number_subjec_key" ON "program_semester_subjects"("program_id", "semester_number", "subject_id");

-- CreateIndex
CREATE INDEX "teacher_subject_assignments_teacher_id_academic_year_idx" ON "teacher_subject_assignments"("teacher_id", "academic_year");

-- CreateIndex
CREATE INDEX "teacher_subject_assignments_batch_id_section_id_semester_nu_idx" ON "teacher_subject_assignments"("batch_id", "section_id", "semester_number");

-- CreateIndex
CREATE UNIQUE INDEX "teacher_subject_assignments_teacher_id_subject_id_batch_id__key" ON "teacher_subject_assignments"("teacher_id", "subject_id", "batch_id", "section_id", "academic_year");

-- CreateIndex
CREATE INDEX "timetables_batch_id_semester_number_academic_year_idx" ON "timetables"("batch_id", "semester_number", "academic_year");

-- CreateIndex
CREATE INDEX "timetables_teacher_id_academic_year_idx" ON "timetables"("teacher_id", "academic_year");

-- CreateIndex
CREATE UNIQUE INDEX "timetables_section_id_day_of_week_time_slot_id_academic_yea_key" ON "timetables"("section_id", "day_of_week", "time_slot_id", "academic_year");

-- CreateIndex
CREATE UNIQUE INDEX "timetables_teacher_id_day_of_week_time_slot_id_academic_yea_key" ON "timetables"("teacher_id", "day_of_week", "time_slot_id", "academic_year");

-- CreateIndex
CREATE UNIQUE INDEX "timetables_classroom_id_day_of_week_time_slot_id_academic_y_key" ON "timetables"("classroom_id", "day_of_week", "time_slot_id", "academic_year");

-- CreateIndex
CREATE INDEX "face_data_student_id_idx" ON "face_data"("student_id");

-- CreateIndex
CREATE INDEX "face_data_status_idx" ON "face_data"("status");

-- CreateIndex
CREATE INDEX "attendance_sessions_session_date_idx" ON "attendance_sessions"("session_date");

-- CreateIndex
CREATE INDEX "attendance_sessions_timetable_id_session_date_idx" ON "attendance_sessions"("timetable_id", "session_date");

-- CreateIndex
CREATE INDEX "attendance_sessions_batch_id_section_id_subject_id_idx" ON "attendance_sessions"("batch_id", "section_id", "subject_id");

-- CreateIndex
CREATE INDEX "attendance_sessions_teacher_id_session_date_idx" ON "attendance_sessions"("teacher_id", "session_date");

-- CreateIndex
CREATE INDEX "attendance_records_student_id_attendance_status_idx" ON "attendance_records"("student_id", "attendance_status");

-- CreateIndex
CREATE INDEX "attendance_records_session_id_idx" ON "attendance_records"("session_id");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_records_session_id_student_id_key" ON "attendance_records"("session_id", "student_id");

-- CreateIndex
CREATE INDEX "attendance_summary_student_id_semester_number_idx" ON "attendance_summary"("student_id", "semester_number");

-- CreateIndex
CREATE INDEX "attendance_summary_attendance_percentage_idx" ON "attendance_summary"("attendance_percentage");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_summary_student_id_subject_id_semester_number_key" ON "attendance_summary"("student_id", "subject_id", "semester_number");

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_department_head_id_fkey" FOREIGN KEY ("department_head_id") REFERENCES "teachers"("teacher_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("department_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teachers" ADD CONSTRAINT "teachers_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("department_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "programs" ADD CONSTRAINT "programs_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("department_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "programs" ADD CONSTRAINT "programs_program_coordinator_id_fkey" FOREIGN KEY ("program_coordinator_id") REFERENCES "teachers"("teacher_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batches" ADD CONSTRAINT "batches_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("program_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batches" ADD CONSTRAINT "batches_batch_advisor_id_fkey" FOREIGN KEY ("batch_advisor_id") REFERENCES "teachers"("teacher_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sections" ADD CONSTRAINT "sections_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("batch_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sections" ADD CONSTRAINT "sections_classroom_id_fkey" FOREIGN KEY ("classroom_id") REFERENCES "classrooms"("classroom_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sections" ADD CONSTRAINT "sections_class_teacher_id_fkey" FOREIGN KEY ("class_teacher_id") REFERENCES "teachers"("teacher_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("batch_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("section_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("program_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guardians" ADD CONSTRAINT "guardians_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("student_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program_semester_subjects" ADD CONSTRAINT "program_semester_subjects_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("program_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program_semester_subjects" ADD CONSTRAINT "program_semester_subjects_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("subject_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_subject_assignments" ADD CONSTRAINT "teacher_subject_assignments_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("teacher_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_subject_assignments" ADD CONSTRAINT "teacher_subject_assignments_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("subject_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_subject_assignments" ADD CONSTRAINT "teacher_subject_assignments_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("batch_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_subject_assignments" ADD CONSTRAINT "teacher_subject_assignments_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("section_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetables" ADD CONSTRAINT "timetables_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("teacher_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetables" ADD CONSTRAINT "timetables_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("subject_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetables" ADD CONSTRAINT "timetables_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("batch_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetables" ADD CONSTRAINT "timetables_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("section_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetables" ADD CONSTRAINT "timetables_classroom_id_fkey" FOREIGN KEY ("classroom_id") REFERENCES "classrooms"("classroom_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetables" ADD CONSTRAINT "timetables_time_slot_id_fkey" FOREIGN KEY ("time_slot_id") REFERENCES "time_slots"("time_slot_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "face_data" ADD CONSTRAINT "face_data_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("student_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_sessions" ADD CONSTRAINT "attendance_sessions_timetable_id_fkey" FOREIGN KEY ("timetable_id") REFERENCES "timetables"("timetable_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_sessions" ADD CONSTRAINT "attendance_sessions_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("teacher_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_sessions" ADD CONSTRAINT "attendance_sessions_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("subject_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_sessions" ADD CONSTRAINT "attendance_sessions_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("batch_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_sessions" ADD CONSTRAINT "attendance_sessions_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("section_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_sessions" ADD CONSTRAINT "attendance_sessions_classroom_id_fkey" FOREIGN KEY ("classroom_id") REFERENCES "classrooms"("classroom_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "attendance_sessions"("session_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("student_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_summary" ADD CONSTRAINT "attendance_summary_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("student_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_summary" ADD CONSTRAINT "attendance_summary_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("subject_id") ON DELETE RESTRICT ON UPDATE CASCADE;
