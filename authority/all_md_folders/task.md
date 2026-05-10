# TASK.md — Prisma Schema Generation for University Attendance System

> **AI Agent Instructions**: Follow each phase sequentially. Do NOT skip steps. Validate each phase before moving to the next. This is a PostgreSQL database using Prisma ORM.

---

## PRE-FLIGHT: BUGS & ISSUES TO FIX

Before writing any Prisma schema, acknowledge and fix the following issues found in the raw SQL:

### Critical Bugs
1. **Circular foreign keys**: `departments.department_head_id` references a teacher, but `teachers` references `departments`. This is a circular dependency. Model `department_head_id` as `BigInt?` (optional scalar) and wire the `@relation` only after both models exist (Phase 5).
2. **`programs.program_coordinator_id`** references a teacher but has NO FK constraint in SQL — add this as an explicit Prisma relation to `Teacher`.
3. **`batches.batch_advisor_id`** references a teacher but has NO FK constraint in SQL — same fix needed.
4. **`sections.classroom_id` and `sections.class_teacher_id`** — referenced fields with no FK constraints declared in SQL. Add explicit Prisma relations.
5. **`classrooms` is declared AFTER `sections`** in the SQL despite sections referencing it — not a Prisma issue but confirms schema was not dependency-ordered.

### Bad Practices to Avoid in Prisma
- `face_encoding` is a long vector string — annotate as `@db.Text`
- `attendance_summary` has NO `updated_at` in SQL — add `updated_at DateTime @updatedAt` in Prisma for consistency
- `time` fields (`start_time`, `end_time`) have no native Prisma scalar — use `DateTime? @db.Time`
- All `status` fields are raw `text` — use `String?` in Prisma (enums would be ideal but keep as String unless instructed otherwise)

---

## PHASE 1 — PRISMA PROJECT SETUP

**Prompt for agent:**
```
you start from next phase only after confirming the following setup steps are complete:

```

---

## PHASE 2 — STANDALONE MODELS (No Foreign Keys)

**Goal**: Create all models that have NO dependencies on other tables first. These are the foundation.

**Tables in this phase**: `departments`, `classrooms`, `time_slots`, `subjects`

> Note: `departments` has a soft link via `department_head_id` to teachers — define the scalar field as `BigInt?` but skip the `@relation` for now. It will be wired in Phase 5.

**Prompt for agent:**
```
In prisma/schema.prisma, create the following 4 models. Use these exact rules:
- All primary keys: `field_name BigInt @id @default(autoincrement()) @map("sql_column_name")`
- Map each model to its exact SQL table name using @@map("table_name")
- All timestamps use DateTime with @default(now())
- Optional fields use Type?
- Do NOT add any @relation fields yet in this phase
- Use @@map to match the snake_case SQL column names

MODEL 1: Department
  @@map("departments")
  department_id    BigInt    @id @default(autoincrement())
  department_code  String?
  department_name  String?
  department_head_id BigInt?
  office_location  String?
  contact_email    String?
  contact_phone    String?
  established_year Int?
  status           String?
  created_at       DateTime  @default(now())
  updated_at       DateTime  @updatedAt

MODEL 2: Classroom
  @@map("classrooms")
  classroom_id        BigInt   @id @default(autoincrement())
  room_number         String?
  building_name       String?
  floor_number        Int?
  seating_capacity    Int?
  room_type           String?
  projector_available Boolean?
  smart_board_available Boolean?
  status              String?
  created_at          DateTime @default(now())
  updated_at          DateTime @updatedAt

MODEL 3: TimeSlot
  @@map("time_slots")
  time_slot_id     BigInt    @id @default(autoincrement())
  slot_name        String?
  start_time       DateTime? @db.Time
  end_time         DateTime? @db.Time
  duration_minutes Int?
  is_break         Boolean?
  created_at       DateTime  @default(now())
  updated_at       DateTime  @updatedAt

MODEL 4: Subject
  @@map("subjects")
  subject_id       BigInt   @id @default(autoincrement())
  subject_code     String?
  subject_name     String?
  department_id    BigInt
  credits          Int?
  subject_type     String?
  lecture_hours    Int?
  tutorial_hours   Int?
  practical_hours  Int?
  syllabus_version String?
  description      String?  @db.Text
  created_at       DateTime @default(now())
  updated_at       DateTime @updatedAt
  (do NOT add @relation for department_id yet)

Run `npx prisma validate` after writing these 4 models. Fix any errors before proceeding.
```

---

## PHASE 3 — TEACHER MODEL (Partial — No Back-Relations Yet)

**Goal**: Create the Teacher model. It references `departments` but `departments` also references teachers — handle carefully.

**Prompt for agent:**
```
Add the Teacher model to schema.prisma.

Rules:
- Map to: "teachers"
- teacher_id is BigInt PK
- department_id is a BigInt scalar only — do NOT add @relation yet (circular dependency fix)
- All date fields use DateTime @db.Date

MODEL: Teacher
  @@map("teachers")
  teacher_id       BigInt    @id @default(autoincrement())
  employee_id      String?
  first_name       String?
  last_name        String?
  gender           String?
  date_of_birth    DateTime? @db.Date
  department_id    BigInt
  designation      String?
  qualification    String?
  specialization   String?
  joining_date     DateTime? @db.Date
  experience_years Int?
  phone_number     String?
  email            String?
  office_room      String?
  employment_type  String?
  salary_grade     String?
  status           String?
  created_at       DateTime  @default(now())
  updated_at       DateTime  @updatedAt

Run `npx prisma validate` after this step.
```

---

## PHASE 4 — CORE ACADEMIC HIERARCHY

**Goal**: Build the chain: Program → Batch → Section → Student → Guardian
Add `@relation` fields now for these clearly linear relationships.

**Prompt for agent:**
```
Add the following 5 models IN ORDER. Each depends on the previous one.
Use @@map() to match exact SQL table names.
Add @relation and back-relation fields as specified.

MODEL 1: Program (depends on Department and Teacher)
  @@map("programs")
  program_id             BigInt   @id @default(autoincrement())
  department_id          BigInt
  program_code           String?
  program_name           String?
  degree_type            String?
  program_duration_years Int?
  total_semesters        Int?
  description            String?  @db.Text
  accreditation_body     String?
  program_coordinator_id BigInt?
  status                 String?
  created_at             DateTime @default(now())
  updated_at             DateTime @updatedAt
  department   Department @relation(fields: [department_id], references: [department_id])
  coordinator  Teacher?   @relation("ProgramCoordinator", fields: [program_coordinator_id], references: [teacher_id])

MODEL 2: Batch (depends on Program and Teacher)
  @@map("batches")
  batch_id                BigInt   @id @default(autoincrement())
  program_id              BigInt
  admission_year          Int?
  expected_graduation_year Int?
  batch_name              String?
  total_students          Int?
  batch_advisor_id        BigInt?
  academic_regulation     String?
  status                  String?
  created_at              DateTime @default(now())
  updated_at              DateTime @updatedAt
  program      Program  @relation(fields: [program_id], references: [program_id])
  batch_advisor Teacher? @relation("BatchAdvisor", fields: [batch_advisor_id], references: [teacher_id])

MODEL 3: Section (depends on Batch, Classroom, Teacher)
  @@map("sections")
  section_id       BigInt   @id @default(autoincrement())
  batch_id         BigInt
  section_name     String?
  classroom_id     BigInt?
  section_strength Int?
  class_teacher_id BigInt?
  floor_number     Int?
  building_name    String?
  status           String?
  created_at       DateTime @default(now())
  updated_at       DateTime @updatedAt
  batch         Batch      @relation(fields: [batch_id], references: [batch_id])
  classroom     Classroom? @relation(fields: [classroom_id], references: [classroom_id])
  class_teacher Teacher?   @relation("SectionTeacher", fields: [class_teacher_id], references: [teacher_id])

MODEL 4: Student (depends on Batch, Section, Program)
  @@map("students")
  student_id             BigInt    @id @default(autoincrement())
  university_roll_number String?
  registration_number    String?
  first_name             String?
  last_name              String?
  gender                 String?
  date_of_birth          DateTime? @db.Date
  batch_id               BigInt
  section_id             BigInt
  program_id             BigInt
  admission_date         DateTime? @db.Date
  current_semester       Int?
  student_status         String?
  email                  String?
  phone_number           String?
  address                String?
  city                   String?
  state                  String?
  country                String?
  postal_code            String?
  blood_group            String?
  nationality            String?
  category               String?
  created_at             DateTime  @default(now())
  updated_at             DateTime  @updatedAt
  batch   Batch   @relation(fields: [batch_id], references: [batch_id])
  section Section @relation(fields: [section_id], references: [section_id])
  program Program @relation(fields: [program_id], references: [program_id])

MODEL 5: Guardian (depends on Student)
  @@map("guardians")
  guardian_id     BigInt   @id @default(autoincrement())
  student_id      BigInt
  father_name     String?
  mother_name     String?
  guardian_name   String?
  relation_type   String?
  phone_number    String?
  alternate_phone String?
  email           String?
  occupation      String?
  address         String?
  city            String?
  state           String?
  postal_code     String?
  created_at      DateTime @default(now())
  updated_at      DateTime @updatedAt
  student Student @relation(fields: [student_id], references: [student_id])

Run `npx prisma validate` after EACH model is added, not just at the end.
```

---

## PHASE 5 — WIRE BACK-RELATIONS AND CIRCULAR REFERENCES

**Goal**: Now that all core models exist, add back-relation arrays and fix the circular `departments ↔ teachers` link.

**Prompt for agent:**
```
Update existing models to add back-relation fields.
Back-relation fields are VIRTUAL in Prisma — they do NOT create database columns.
They are required so Prisma can resolve both sides of every @relation.

STEP 1 — Update Department model — add these fields:
  department_head Teacher?  @relation("DepartmentHead", fields: [department_head_id], references: [teacher_id])
  teachers        Teacher[] @relation("TeacherDepartment")
  programs        Program[]
  subjects        Subject[]

STEP 2 — Update Teacher model — add these fields:
  department          Department  @relation("TeacherDepartment", fields: [department_id], references: [department_id])
  department_headed   Department? @relation("DepartmentHead")
  coordinated_programs Program[]  @relation("ProgramCoordinator")
  advised_batches     Batch[]     @relation("BatchAdvisor")
  section_classes     Section[]   @relation("SectionTeacher")

STEP 3 — Update Program model — add back-relations:
  batches           Batch[]
  students          Student[]
  semester_subjects ProgramSemesterSubject[]

STEP 4 — Update Subject model — add relation + back-relations:
  department        Department             @relation(fields: [department_id], references: [department_id])
  program_semesters ProgramSemesterSubject[]

STEP 5 — Update Batch model — add back-relations:
  sections  Section[]
  students  Student[]

STEP 6 — Update Section model — add back-relations:
  students  Student[]

STEP 7 — Update Student model — add back-relations:
  guardian             Guardian?
  face_data            FaceData[]
  attendance_records   AttendanceRecord[]
  attendance_summaries AttendanceSummary[]

STEP 8 — Update Classroom model — add back-relations:
  sections  Section[]

Run `npx prisma validate` — it MUST pass with zero errors before continuing.
If you get "The relation X is missing an opposite relation" errors, check that both sides of every named @relation are present.
```

---

## PHASE 6 — JUNCTION & ASSIGNMENT MODELS

**Goal**: Add the many-to-many and assignment tables.

**Prompt for agent:**
```
Add the following 2 models. Then add their back-relations to the relevant existing models.

MODEL 1: ProgramSemesterSubject
  @@map("program_semester_subjects")
  program_semester_subject_id BigInt   @id @default(autoincrement())
  program_id                  BigInt
  semester_number             Int?
  subject_id                  BigInt
  subject_order               Int?
  subject_category            String?
  credits                     Int?
  created_at                  DateTime @default(now())
  updated_at                  DateTime @updatedAt
  program Program @relation(fields: [program_id], references: [program_id])
  subject Subject @relation(fields: [subject_id], references: [subject_id])

MODEL 2: TeacherSubjectAssignment
  @@map("teacher_subject_assignments")
  assignment_id           BigInt   @id @default(autoincrement())
  teacher_id              BigInt
  subject_id              BigInt
  batch_id                BigInt
  section_id              BigInt
  semester_number         Int?
  academic_year           String?
  assigned_hours_per_week Int?
  assignment_role         String?
  created_at              DateTime @default(now())
  updated_at              DateTime @updatedAt
  teacher  Teacher  @relation(fields: [teacher_id], references: [teacher_id])
  subject  Subject  @relation(fields: [subject_id], references: [subject_id])
  batch    Batch    @relation(fields: [batch_id], references: [batch_id])
  section  Section  @relation(fields: [section_id], references: [section_id])

After adding these models, update the following existing models with back-relations:
  Teacher  → add: subject_assignments TeacherSubjectAssignment[]
  Subject  → add: teacher_assignments TeacherSubjectAssignment[]
  Batch    → add: teacher_assignments TeacherSubjectAssignment[]
  Section  → add: teacher_assignments TeacherSubjectAssignment[]

Run `npx prisma validate` after this phase.
```

---

## PHASE 7 — TIMETABLE & ATTENDANCE MODELS

**Goal**: Add the operational/runtime tables.

**Prompt for agent:**
```
Add the following 5 models IN ORDER:

MODEL 1: Timetable
  @@map("timetables")
  timetable_id     BigInt   @id @default(autoincrement())
  teacher_id       BigInt
  subject_id       BigInt
  batch_id         BigInt
  section_id       BigInt
  classroom_id     BigInt
  semester_number  Int?
  day_of_week      String?
  time_slot_id     BigInt
  academic_year    String?
  timetable_status String?
  created_at       DateTime @default(now())
  updated_at       DateTime @updatedAt
  teacher   Teacher   @relation(fields: [teacher_id], references: [teacher_id])
  subject   Subject   @relation(fields: [subject_id], references: [subject_id])
  batch     Batch     @relation(fields: [batch_id], references: [batch_id])
  section   Section   @relation(fields: [section_id], references: [section_id])
  classroom Classroom @relation(fields: [classroom_id], references: [classroom_id])
  time_slot TimeSlot  @relation(fields: [time_slot_id], references: [time_slot_id])
  attendance_sessions AttendanceSession[]

MODEL 2: FaceData
  @@map("face_data")
  face_id              BigInt    @id @default(autoincrement())
  student_id           BigInt
  image_path           String?
  face_encoding        String?   @db.Text
  dataset_version      String?
  capture_date         DateTime? @db.Date
  image_quality_score  Float?
  status               String?
  created_at           DateTime  @default(now())
  updated_at           DateTime  @updatedAt
  student Student @relation(fields: [student_id], references: [student_id])

MODEL 3: AttendanceSession
  @@map("attendance_sessions")
  session_id         BigInt    @id @default(autoincrement())
  timetable_id       BigInt
  teacher_id         BigInt
  subject_id         BigInt
  batch_id           BigInt
  section_id         BigInt
  classroom_id       BigInt
  session_date       DateTime? @db.Date
  start_time         DateTime? @db.Time
  end_time           DateTime? @db.Time
  attendance_method  String?
  total_students     Int?
  present_count      Int?
  absent_count       Int?
  created_at         DateTime  @default(now())
  updated_at         DateTime  @updatedAt
  timetable Timetable @relation(fields: [timetable_id], references: [timetable_id])
  teacher   Teacher   @relation(fields: [teacher_id], references: [teacher_id])
  subject   Subject   @relation(fields: [subject_id], references: [subject_id])
  batch     Batch     @relation(fields: [batch_id], references: [batch_id])
  section   Section   @relation(fields: [section_id], references: [section_id])
  classroom Classroom @relation(fields: [classroom_id], references: [classroom_id])
  attendance_records AttendanceRecord[]

MODEL 4: AttendanceRecord
  @@map("attendance_records")
  attendance_id        BigInt    @id @default(autoincrement())
  session_id           BigInt
  student_id           BigInt
  attendance_status    String?
  detection_confidence Float?
  capture_time         DateTime?
  marked_by            String?
  remarks              String?
  created_at           DateTime  @default(now())
  updated_at           DateTime  @updatedAt
  session AttendanceSession @relation(fields: [session_id], references: [session_id])
  student Student           @relation(fields: [student_id], references: [student_id])

MODEL 5: AttendanceSummary
  @@map("attendance_summary")
  summary_id            BigInt   @id @default(autoincrement())
  student_id            BigInt
  subject_id            BigInt
  semester_number       Int?
  total_classes         Int?
  classes_attended      Int?
  classes_missed        Int?
  attendance_percentage Float?
  last_updated          DateTime @default(now())
  updated_at            DateTime @updatedAt
  student Student @relation(fields: [student_id], references: [student_id])
  subject Subject @relation(fields: [subject_id], references: [subject_id])

After adding these models, update the following existing models with back-relations:
  Teacher   → add: timetables Timetable[], attendance_sessions AttendanceSession[]
  Subject   → add: timetables Timetable[], attendance_sessions AttendanceSession[], attendance_summaries AttendanceSummary[]
  Batch     → add: timetables Timetable[], attendance_sessions AttendanceSession[]
  Section   → add: timetables Timetable[], attendance_sessions AttendanceSession[]
  Classroom → add: timetables Timetable[], attendance_sessions AttendanceSession[]
  TimeSlot  → add: timetables Timetable[]
  Subject   → add: attendance_summaries AttendanceSummary[]

Run `npx prisma validate` — must pass before continuing.
```

---

## PHASE 8 — ADD INDEXES FOR PERFORMANCE

**Goal**: Add `@@index` and `@@unique` directives to all models.

**Prompt for agent:**
```
Add the following indexes to each model using @@index([...]) and @@unique([...]) 
inside the model block, AFTER all fields and relations.
Do NOT use raw SQL — use only Prisma @@index and @@unique directives.

Department:
  @@unique([department_code])

Teacher:
  @@unique([employee_id])
  @@unique([email])
  @@index([department_id])
  @@index([status])

Student:
  @@unique([university_roll_number])
  @@unique([registration_number])
  @@index([batch_id])
  @@index([section_id])
  @@index([program_id])
  @@index([student_status])
  @@index([email])

Program:
  @@unique([program_code])
  @@index([department_id])
  @@index([status])

Batch:
  @@index([program_id])
  @@index([admission_year])
  @@index([status])

Section:
  @@index([batch_id])
  @@index([classroom_id])

Subject:
  @@unique([subject_code])
  @@index([department_id])

ProgramSemesterSubject:
  @@unique([program_id, semester_number, subject_id])
  @@index([program_id, semester_number])

TeacherSubjectAssignment:
  @@unique([teacher_id, subject_id, batch_id, section_id, academic_year])
  @@index([teacher_id, academic_year])
  @@index([batch_id, section_id, semester_number])

Timetable:
  @@unique([section_id, day_of_week, time_slot_id, academic_year])
  @@unique([teacher_id, day_of_week, time_slot_id, academic_year])
  @@unique([classroom_id, day_of_week, time_slot_id, academic_year])
  @@index([batch_id, semester_number, academic_year])
  @@index([teacher_id, academic_year])

AttendanceSession:
  @@index([session_date])
  @@index([timetable_id, session_date])
  @@index([batch_id, section_id, subject_id])
  @@index([teacher_id, session_date])

AttendanceRecord:
  @@unique([session_id, student_id])
  @@index([student_id, attendance_status])
  @@index([session_id])

AttendanceSummary:
  @@unique([student_id, subject_id, semester_number])
  @@index([student_id, semester_number])
  @@index([attendance_percentage])

FaceData:
  @@index([student_id])
  @@index([status])

Run `npx prisma validate` after all indexes are added.
```

---

## PHASE 9 — FINAL VALIDATION & MIGRATION

**Prompt for agent:**
```
Run the following checks in order. Do NOT proceed to the next step if the current one fails.

STEP 1: `npx prisma validate`
  → Must show: "The schema at prisma/schema.prisma is valid"
  → If it fails, read the error, go back to the relevant phase, fix the issue

STEP 2: `npx prisma format`
  → Auto-formats the schema file
  → This is safe to run — it only affects whitespace and ordering

STEP 3: `npx prisma migrate dev --name init`
  → Creates and applies the initial migration
  → If error "already exists" → run `npx prisma migrate reset` first (DEV ONLY — destroys data)
  → If error about relations → go back to the phase where that model was defined and fix the @relation name

STEP 4: `npx prisma generate`
  → Generates the Prisma Client
  → Must complete without errors

STEP 5: Verify with `npx prisma studio`
  → Open in browser
  → Confirm all 18 tables appear
  → Click each table and verify columns match the original SQL
```

---

## RECENT OPTIMIZATION CHANGES (APPLIED)

The following updates were applied after the initial schema build to reduce data redundancy risk and improve query/index performance.

### 1) New Indexes Added

#### Program
- `@@index([program_coordinator_id])`

#### Batch
- `@@index([batch_advisor_id])`

#### Section
- `@@index([class_teacher_id])`

#### ProgramSemesterSubject
- `@@index([subject_id])`

#### TeacherSubjectAssignment
- `@@index([subject_id, academic_year])`

#### Timetable
- `@@index([section_id, academic_year])`
- `@@index([subject_id, academic_year])`

#### AttendanceSession
- `@@index([subject_id, session_date])`

#### AttendanceSummary
- `@@index([subject_id, semester_number])`

### 2) Null-Unique Redundancy Fixes (Made Required)

These fields participate in unique/business-key patterns and were switched from optional to required to avoid duplicate rows via `NULL` behavior.

#### ProgramSemesterSubject
- `semester_number Int?` -> `semester_number Int`

#### TeacherSubjectAssignment
- `academic_year String?` -> `academic_year String`

#### Timetable
- `day_of_week String?` -> `day_of_week String`
- `academic_year String?` -> `academic_year String`

#### AttendanceSummary
- `semester_number Int?` -> `semester_number Int`

### 3) Why These Changes Matter

- Better join/filter performance for common coordinator/advisor/teacher/subject reports.
- Better lookup speed on timetable and attendance drill-down queries.
- Stronger duplicate prevention where nullable fields could weaken uniqueness guarantees.

### 4) Validation Status

- `npx prisma validate` passed after these changes.
- Next migration command for DB sync:
  - `npx prisma migrate dev --name tighten_indexes_and_uniques`

---

## RELATIONSHIP MAP (Quick Reference)

```
Department
  ├── has many Teachers          (TeacherDepartment)
  ├── has many Programs
  ├── has many Subjects
  └── has one department_head → Teacher (optional, DepartmentHead)

Program
  ├── belongs to Department
  ├── has one coordinator → Teacher (optional, ProgramCoordinator)
  ├── has many Batches
  ├── has many Students
  └── has many ProgramSemesterSubjects

Batch
  ├── belongs to Program
  ├── has one batch_advisor → Teacher (optional, BatchAdvisor)
  ├── has many Sections
  └── has many Students

Section
  ├── belongs to Batch
  ├── has one Classroom (optional)
  ├── has one class_teacher → Teacher (optional, SectionTeacher)
  └── has many Students

Student
  ├── belongs to Batch, Section, Program
  ├── has one Guardian
  ├── has many FaceData
  ├── has many AttendanceRecords
  └── has many AttendanceSummaries

Subject
  ├── belongs to Department
  ├── has many ProgramSemesterSubjects
  ├── used in TeacherSubjectAssignments
  ├── used in Timetables
  ├── used in AttendanceSessions
  └── used in AttendanceSummaries

Timetable
  ├── links Teacher + Subject + Batch + Section + Classroom + TimeSlot
  └── has many AttendanceSessions

AttendanceSession
  ├── links Timetable + Teacher + Subject + Batch + Section + Classroom
  └── has many AttendanceRecords
```

---

## MODEL COUNT: 18 TOTAL

| Phase | Models |
|-------|--------|
| Phase 2 | Department, Classroom, TimeSlot, Subject |
| Phase 3 | Teacher |
| Phase 4 | Program, Batch, Section, Student, Guardian |
| Phase 6 | ProgramSemesterSubject, TeacherSubjectAssignment |
| Phase 7 | Timetable, FaceData, AttendanceSession, AttendanceRecord, AttendanceSummary |

---

> After Phase 9 completes successfully, the Prisma schema is production-ready.
