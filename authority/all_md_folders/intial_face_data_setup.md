# Initial Face Data Setup Checklist (Enrollment)

This document specifies the mandatory inputs and validation rules required to correctly register student face data in the system.

---

## 1. Mandatory Input Fields
To populate the `FaceData` table without errors, the registration API must receive:

| Field | Type | Description |
| :--- | :--- | :--- |
| `student_id` | `BigInt` | Required. The primary key of the student being registered. |
| `samples` | `Array` | A list of 3 image objects (Front, Left, Right). |
| `model_name` | `String` | e.g., `"ArcFace"`. Stored to manage future AI model upgrades. |
| `dataset_version`| `String` | e.g., `"v1.0"`. Useful for tracking global data resets. |
| `registration_date`| `DateTime`| The date the photos were captured. |

---

## 2. Capture Strategy (3 Angles)
Storing multiple angles significantly improves matching accuracy during attendance taking.
1.  **Front View**: (Mark as `is_primary: true`) The main face reference.
2.  **Left Profile**: (Mark as `face_angle: "Left"`) To handle students sitting on the far-left side of a class.
3.  **Right Profile**: (Mark as `face_angle: "Right"`) To handle students sitting on the far-right side of a class.

---

## 3. Mandatory AI Validation Rules
To prevent data corruption, every registration attempt must follow these rules:

- **Face Count = 1**: The photo **must** contain exactly one face. If **0** or **>1** faces are detected by the Python server, **reject** the registration and ask the student to re-capture.
- **Confidence Score**: Only accept vectors with a high detection confidence (e.g., > 0.90) to ensure the reference data is sharp.
- **No duplicates**: (Optional) Check if the student already has an active `FaceData` entry. If so, mark the old entries as `status: "INACTIVE"` before saving the new ones.

---

## 4. Proposed API Payload (JSON Example)
```json
{
  "student_id": 1025,
  "model_name": "ArcFace",
  "dataset_version": "v1.0",
  "face_samples": [
    { "angle": "Front", "image_b64": "..." },
    { "angle": "Left", "image_b64": "..." },
    { "angle": "Right", "image_b64": "..." }
  ]
}
```

## 5. Database Mapping (Next.js Logic)
For each sample in the array, Next.js should:
1. Call Python API to get a **512-d vector**.
2. Save the original image to `/public/uploads/faces/[student_id]_[angle].jpg`.
3. Create a record in the **`FaceData`** table with the vector string and the image path.
