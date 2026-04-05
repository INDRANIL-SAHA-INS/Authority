# Face Attendance System: Future Roadmap

This document provides a phased implementation plan for the facial recognition attendance system, combining the Next.js (Database Boss) and Python (AI Calculator) architectures.

---

## Phase 1: Initial Face Data Setup (Enrollment)
**Goal**: Build a robust database of reference face vectors for all students.

### 1. Requirements & Inputs
- **Frontend Input**: A stream of 3 high-quality images: **Front**, **Left Profile**, **Right Profile**.
- **Backend Input**: `student_id` (BigInt), `angle` (Front/Left/Right).
- **Validation**: Python API must return exactly **1 face** for each image. Reject if 0 or >1 face is found.

### 2. API Routes to Create
- **Python (Microservice)**: `POST /api/v1/detect`
    - Already exists in your `main.py`. Ensure it returns the 512-d **ArcFace** vector.
- **Next.js (Web Server)**: `POST /api/v1/student/register-face`
    - Accepts the 3 images and `studentId`.
    - Loops through images, calls Python API for vectors.
    - Saves images to `/public/uploads/faces/`.
    - Creates **`FaceData`** records in PostgreSQL.

---

## Phase 2: Detecting & Matching (Attendance Taking)
**Goal**: Identify many students from a single collective photo of the class.

### 1. Requirements & Inputs
- **Frontend Input**: One high-resolution photo of the whole class.
- **Context API Input**: `section_id`, `session_id` (from the active attendance session).
- **Matching Logic**: Euclidean Distance between detected vectors and the student vectors in that specific `section_id`.

### 2. API Routes to Create
- **Python (Microservice)**: `POST /api/v1/detect`
    - Handles the multi-face detection in the classroom image.
    - Returns a list of vectors + Base64 crops for all detected faces.
- **Next.js (Web Server)**: `POST /api/v1/attendance/take-attendance`
    - Accepts `sessionId` and the classroom image.
    - **Step A**: Fetch all `FaceData` where `student.section_id` matches the current session.
    - **Step B**: Call Python API for the classroom detections.
    - **Step C**: Match detected vectors against the 60-student reference list.
    - **Step D**: Bulk update **`AttendanceRecord`** for all matched students and save their individual "proof" face crops.

---

## Phase 3: Verification & Auditing
**Goal**: Allow teachers to manually verify AI decisions.

### 1. Requirements & Inputs
- **Frontend UI**: A list of students marked "Present" with a thumbnail of their `captured_face_url`.
- **User Action**: Teacher can override a "Present" mark if they see the AI made a mistake.

### 2. API Routes
- **Next.js**: `PATCH /api/v1/attendance/manual-override`
    - Updates a specific `attendance_id` with a different status and an optional `remark`.

---

## Summary of Data Flow
| Action | Orchestrator | Engine | Storage |
| :--- | :--- | :--- | :--- |
| **Registration** | Next.js | Python (ArcFace) | `FaceData` table |
| **Detection** | Next.js | Python (RetinaFace) | `AttendanceSession` table |
| **Matching** | Next.js | Numpy (Euclidean) | `AttendanceRecord` table |
