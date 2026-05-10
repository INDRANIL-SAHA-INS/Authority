# Marks Extraction & Database Upload: Test Strategy

This document outlines the test cases, edge cases, and architectural strategy for handling dynamic marks extraction and preparing them for the database.

## 1. Architectural Strategy: "Transform & Handover"

To ensure reliability and performance, the process is split between the **Python Microservice** (Data Preparation) and the **Next.js Backend** (Database Persistence).

1.  **Extraction**: Python Microservice extracts raw data from PDF/Excel.
2.  **AI Mapping**: AI identifies the mapping between raw keys and standard DB columns/meaningful JSON keys.
3.  **Transformation**: A fixed Python function transforms the raw data into a **Database-Friendly Format**.
4.  **Handover**: The Microservice returns the formatted JSON to Next.js.
5.  **Persistence**: Next.js loops through the ready-to-insert data and performs Prisma upserts.

---

## 2. Test Cases

### A. Student Identification
| Test Case | Description | Expected Behavior |
| :--- | :--- | :--- |
| **Valid USN** | Student exists in DB with matching `university_roll_number`. | Correctly resolve `student_id` in Next.js. |
| **Missing USN** | USN in file does not exist in the `students` table. | Flag in the transformed JSON for Next.js to handle. |
| **Duplicate USN** | The same USN appears multiple times in one file. | Microservice should deduplicate or flag before handover. |

### B. Marks & Attendance
| Test Case | Description | Expected Behavior |
| :--- | :--- | :--- |
| **Literal Absent** | Raw JSON contains `"AB"` or `"Absent"`. | Map to `is_absent: true` and `marks_obtained: 0`. |
| **Empty Value** | Key exists but value is `""` or `null`. | Handle as `0` and set `is_absent` flag if applicable. |
| **Numeric Strings** | Marks provided as strings (e.g., `"15.5"`). | Cast to `Float` during the Transformation step. |
| **Bounds Check** | `marks_obtained` > `total_marks` provided by metadata. | Microservice flags the record as `invalid` in the payload. |

---

## 3. Use of AI for Mapping & Normalization

The AI is used specifically for **Schema Discovery** to bridge the gap between dynamic files and your fixed database columns.

### Task 1: Column Routing (Fixed Schema)
AI identifies which raw key maps to the core database columns defined in `schema.prisma`.
- `total_20_marks` → `marks_obtained`
- `usn` → `student_identifier`

### Task 2: Meaningful Key Formatting (Sub-parts)
AI maps raw component keys to clean, human-readable keys for the `sub_marks` JSON object.
- `assignment_10_marks` → `Assignment`
- `quiz_10_marks` → `Quiz`

**Example AI Output (Mapping Logic):**
```json
{
  "column_routing": {
    "marks_obtained_key": "total_20_marks",
    "student_identifier_key": "usn"
  },
  "sub_parts": [
    { "raw_key": "assignment_10_marks", "meaningful_name": "Assignment" },
    { "raw_key": "quiz_10_marks", "meaningful_name": "Quiz" }
  ]
}
```

---

## 4. The "Database-Friendly" Handover Format

The Microservice returns this structure to the Next.js backend. This format allows the Node.js side to loop and insert with zero complex logic.

```json
{
  "metadata": {
    "canonical_components": ["Assignment", "Quiz"]
  },
  "records": [
    {
      "student_identifier": "1RUA24BCA0001",
      "marks_obtained": 15,
      "is_absent": false,
      "sub_marks": {
        "Assignment": 8,
        "Quiz": 7
      }
    }
  ]
}
```

---

## 5. Implementation Checklist

### Python Microservice
- [ ] Create `mapping_service` that calls AI for schema discovery.
- [ ] Create `transformation_service` to apply mapping and return the "Handover Format".
- [ ] Implement error flagging for out-of-bounds marks.

### Next.js Backend
- [ ] Update `schema.prisma` with `sub_marks` (Json) and `components` (Json).
- [ ] Create API route to receive the "Handover JSON".
- [ ] Implement simple loop for `prisma.examResult.upsert`.
