# 📋 Step-by-Step Data Entry Guide

When you are putting data into your database, you must follow this exact order. This prevents "Error" messages where the database complains that it can't find a piece of related information.

---

### Step 1: The Basics (Fill these first)
These tables are independent. They don't need any other information to exist.
1.  **classrooms** (The actual rooms in your building)
2.  **time_slots** (The timings of your classes, like 9:00 AM - 10:00 AM)
3.  **academic_periods** (The current semester name, like "Fall 2024")

---

### Step 2: The Department Setup
There is a "back and forth" relationship between Departments and Teachers, so follow this trick:
4.  **departments**: Fill all your departments (like CS, ME, IT) but **leave the "Head of Department" field empty** for now.
5.  **teachers**: Fill your teacher list. You can now link each teacher to their department.
6.  **departments (Update)**: Go back to your departments and now fill in who the "Head of Department" is.

---

### Step 3: Courses and Lessons
7.  **programs**: Fill in the degree names (like B.Tech in Computer Science). This needs a Department.
8.  **subjects**: List out all the subjects (like Maths, Physics, AI). Each subject must be linked to a Program.

---

### Step 4: Groups and Classes
9.  **batches**: Fill in the student batch names (like "Class of 2023"). This needs a Period and a Program.
10. **sections**: Divide your batches into Sections (like Section A, Section B). This needs a Batch and a Classroom.

---

### Step 5: The Students
11. **students**: Now add your students. Every student must be linked to a Batch, a Section, and a Program.
12. **guardians**: Add parent or guardian details for each student.
13. **face_data**: Add the face recognition data for each student.

---

### Step 6: The Semester Schedule
14. **subject_enrollments**: Link each student to the subjects they are studying this semester.
15. **teacher_subject_assignments**: Tell the database which teacher is teaching which subject to which section.
16. **timetables**: Create the weekly schedule. Now that teachers, subjects, and rooms are all in the system, you can set the times for each class.

---

### Step 7: Exams and Daily Work
17. **exams**: Define the exams coming up (like Mid-term or Final exam).
18. **attendance_sessions**: Every day when a class happens, a "session" is created for it.

---

### Step 8: Results and Daily Records (Fill these last)
19. **exam_results**: Enter the marks each student got in their exams.
20. **attendance_records**: Mark each student as "Present" or "Absent" for each class session.
21. **student_backlogs**: If a student fails an exam, the information goes here so they can clear it later.
22. **library_visit_logs**: Track student entry and exit timestamps for library sessions.
23. **attendance_summary**: The system will automatically calculate the final attendance percentage based on all the daily records.

---

### ✅ Quick Recap of the Order:
1. Basics (Rooms, Times, Semesters)
2. Departments (No Head)
3. Teachers
4. Finish Departments (Add Head)
5. Programs & Subjects
6. Batches & Sections
7. Students & Parents
8. Schedule (Enrollment, Teacher Tasks, Timetable)
9. Exams & Class Sessions
10. Final Marks, Library Visits & Daily Attendance
