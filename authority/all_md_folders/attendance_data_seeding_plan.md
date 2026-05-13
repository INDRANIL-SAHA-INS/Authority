# Attendance Data Seeding Plan

This document outlines the strategy for seeding historical attendance data into the system, ensuring consistency between the schedule, actual class sessions, and student summary metrics.

## 1. User Requirements for Manual Entry

The objective is to simulate a full academic year of attendance data for a specific section to test the Student Dashboard and Analytics.

- **Timeline**: From **April 1, 2026**, to **May 12, 2026**.
- **Working Days**: All 7 days of the week (Monday through Sunday) are considered working days with classes held.
- **Data Quality**:
  - **Marked By**: Must mention the Teacher (e.g., "Teacher: [Name]") retrieved from the `Teacher` table.
  - **Remarks**: Set to `null`.
  - **Detection Confidence**: A random float value between **0.85 and 1.0** (simulating high-confidence face detection or manual verification).
  - **Probability**: Attendance should be randomized but realistic (e.g., ~88% average attendance rate).

## 2. Configuration Data Provided

The script is targeted at the following specific entities:

- **Section ID**: `264579083378102272`
- **Batch ID**: `264577534782345216`
- **Period ID**: `264556692765675520`
- **Timetable Status**: `ACTIVE`

## 3. Database Architecture & Snapshots

The script follows a **Denormalization Strategy** (Snapshotted Data) as defined in the schema:

- **Why**: Even though `subject_id` and `teacher_id` exist in the `Timetable` table, they are copied into `AttendanceSession` to preserve historical truth. If a timetable changes in the future, the past attendance records remain accurate.
- **Fields to Populate**:
  - `AttendanceSession`: `timetable_id`, `teacher_id`, `subject_id`, `batch_id`, `section_id`, `classroom_id`, `session_date`, `start_time`, `end_time`.
  - **Calculated Columns**: `total_students`, `present_count`, `absent_count`.

## 4. Edge Cases & Constraints

The script must handle the following technical challenges:

### A. Multiple Sessions for One Subject

- **Scenario**: If "Math" appears twice in the same day (two different `timetable_id`s).
- **Logic**: The script iterates per `timetable_id`. Each class counts as a separate unit. A student missing the morning Math class but attending the afternoon one will have 50% attendance for that day.

### B. Unique Constraints

- **Session Constraint**: `@@unique([timetable_id, session_date])` ensures we don't create two sessions for the same slot on the same day.
- **Record Constraint**: `@@unique([session_id, student_id])` prevents duplicate attendance marks for a student in one class.
- **Handling**: The script will use `upsert` or "delete-before-insert" logic to avoid crashes if partial data already exists.

### C. BigInt & Snowflake IDs

- All IDs must be handled as `BigInt` using the `generateSnowflake()` utility from `lib/snowflake.ts`.

### D. Real-Time Summary Sync

- **Problem**: If we only add records, the `AttendanceSummary` (Dashboard) will show 0%.
- **Solution**: The script will recalculate the `total_classes`, `classes_attended`, and `percentage` for every student in the target section at the end of the process to ensure the "Scoreboard" is accurate.

## 5. Execution Strategy

1.  **Preparation**: Fetch all `Timetable` records and `Student` records for the section.
2.  **The Loop**: Iterate through dates using a `while` loop (Date object).
3.  **Batching**: To avoid database timeouts, data will be committed in chunks.
4.  **Final Polish**: Update the `AttendanceSummary` table.
