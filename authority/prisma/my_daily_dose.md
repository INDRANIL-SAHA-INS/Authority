# Face Detection & Attendance System: Integration Guide

This document outlines the final architecture and data flow for the facial recognition attendance system.

---

## 1. System Architecture: "Next.js as the Boss"
To maintain security and simplicity, only **Next.js** connects to the PostgreSQL database.

1.  **Next.js (Backend)**: Manages Prisma, Auth, and Business Logic.
2.  **Python (Microservice)**: A "Stateless AI Calculator" (FastAPI). It takes an image and returns JSON data (bounding boxes + 512-d ArcFace vectors). It **never** connects to the database.

---

## 2. Phase 1: Student Registration (Enrollment)
Each student must register their face before they can be marked present.

### The Flow:
1.  **Capture**: The UI asks the student to take 3 photos: **Front**, **Left Profile**, and **Right Profile**.
2.  **AI Detection**: Next.js sends each photo to the Python API. 
3.  **STRICT RULE (Validation)**: If Python returns **0** or **>1 faces** for a registration photo, reject it. This ensures only the student's face is in their reference data.
4.  **Database Storage**: 
    - Store the image path in `FaceData.image_path`.
    - Store the 512-d vector as a JSON string in `FaceData.face_encoding`.
    - Mark the Front photo as `is_primary = true`.

---

## 3. Phase 2: Taking Attendance (The Whole Class)
This phase uses one collective photo of the entire classroom to mark many students present at once.

### The Flow:
1.  **Teacher Action**: Takes a single high-resolution photo of the classroom.
2.  **Full Logic Step-by-Step**:
    - **A. Save Image**: Save the full classroom photo to `AttendanceSession.class_photo_url`.
    - **B. AI Request**: Send the full photo to Python. Python returns a JSON list of all detected faces ($N$ faces).
    - **C. Optimize (Section Filter)**: Fetch all `FaceData` for students where `section_id == current_section_id`. This reduces your search list to ~60 students.
    - **D. Match**: Loop through each of the $N$ faces from Python and compare them against your 60-student list.
    - **E. Record**: For each matched student ($S$):
        - Mark `AttendanceRecord` as **PRESENT**.
        - Save the tiny face crop (from Python's Base64) to `AttendanceRecord.captured_face_url` as evidence.

---

## 4. The Matching Math (Non-pgvector)
Since we use `@db.Text (String)` for the encodings, the math happens in your code.

1.  **Preparation**: Parse the string: `ref_vector = np.array(json.loads(db_encoding))`
2.  **Comparison**: Use **Euclidean Distance** (or Cosine Similarity):
    ```python
    import numpy as np
    dist = np.linalg.norm(detected_vector - ref_vector)
    # Match Threshold: Typically < 0.6 for ArcFace
    is_match = (dist < 0.6)
    ```
3.  **Handling Angle Samples**: If a student has 3 photos, compare the detected face against all 3. If **ANY ONE** matches, the student is marked present.

---

## 5. Required Model & Settings
- **AI Model**: `ArcFace` (available in `DeepFace` library).
- **Format**: 512-dimensional numeric vector.
- **Why**: Handles side profiles and different lighting much better than FaceNet.
- **Efficiency**: Matching 3 vectors for 60 students (~180 ops) takes <1ms in Python/Numpy.
