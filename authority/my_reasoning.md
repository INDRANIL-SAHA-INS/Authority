# my_reasoning.md — Schema Optimization Decisions

This document explains the **recent changes** made in `prisma/schema.prisma` and the reasoning behind each one.

## Purpose

The goal of these updates was:
- reduce data redundancy risk,
- improve relationship query performance,
- keep existing business fields and table structure intact.

No model/table was removed in this pass.

## Changes Made

### 1) Added Index: Program

Change:
- Added `@@index([program_coordinator_id])` in `Program`.

Why:
- `program_coordinator_id` is a foreign key to `Teacher`.
- Coordinator-based filtering and joins become faster.
- Without an index, coordinator lookups can degrade as row count grows.

### 2) Added Index: Batch

Change:
- Added `@@index([batch_advisor_id])` in `Batch`.

Why:
- `batch_advisor_id` is a foreign key to `Teacher`.
- Improves advisor-to-batch queries and join performance.

### 3) Added Index: Section

Change:
- Added `@@index([class_teacher_id])` in `Section`.

Why:
- `class_teacher_id` is used to map teacher-to-section responsibilities.
- Faster section listings by class teacher.

### 4) Added Indexes: ProgramSemesterSubject

Changes:
- Added `@@index([subject_id])`.

Why:
- Existing index favored program-semester path.
- Subject-centric traversal also needs a direct index.
- Improves reverse lookup: subject -> program-semester mappings.

### 5) Added Indexes: TeacherSubjectAssignment

Changes:
- Added `@@index([subject_id, academic_year])`.

Why:
- Existing index already supported teacher-year and batch-section-semester paths.
- Subject-year analytics and assignment lookups needed direct support.

### 6) Added Indexes: Timetable

Changes:
- Added `@@index([section_id, academic_year])`.
- Added `@@index([subject_id, academic_year])`.

Why:
- Timetable reads are commonly year-scoped.
- These indexes speed section/year and subject/year timetable retrieval.
- Existing unique constraints protect collision logic, but these new indexes optimize read patterns.

### 7) Added Index: AttendanceSession

Change:
- Added `@@index([subject_id, session_date])`.

Why:
- Attendance reporting is often subject + date filtered.
- Reduces scan cost for subject/date session queries.

### 8) Added Index: AttendanceSummary

Change:
- Added `@@index([subject_id, semester_number])`.

Why:
- Existing index favored student-semester path.
- Subject-semester aggregates also need efficient access.

### 9) Requiredness Tightening for Unique/Business Keys

These fields were changed from optional to required:
- `ProgramSemesterSubject.semester_number` (`Int?` -> `Int`)
- `TeacherSubjectAssignment.academic_year` (`String?` -> `String`)
- `Timetable.day_of_week` (`String?` -> `String`)
- `Timetable.academic_year` (`String?` -> `String`)
- `AttendanceSummary.semester_number` (`Int?` -> `Int`)

Why:
- PostgreSQL unique constraints allow multiple NULL values.
- If key columns remain nullable, duplicate-like records can still enter through NULL combinations.
- Making these key columns required strengthens true uniqueness and reduces logical redundancy.

## Redundancy and Performance Outcome

Expected improvements:
- Better read performance for coordinator/advisor/class-teacher relationships.
- Faster timetable and attendance reports by year/date/subject filters.
- Stronger duplicate prevention on business-key combinations.

## Validation

Verification done after changes:
- `npx prisma validate` passed.

Recommended next step to persist changes in DB:
- `npx prisma migrate dev --name tighten_indexes_and_uniques`
