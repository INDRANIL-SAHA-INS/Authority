import requests
from typing import List, Optional
from models import StudentRecord

# ─── Point this to your Next.js backend ──────────────────────────────────────
BASE_URL = "http://localhost:3000/api"


def fetch_students_by_threshold(
    section_id: str,
    threshold: float = 85.0
) -> List[StudentRecord]:
    """
    Calls your Next.js API to get all students in a section
    whose attendance is BELOW the given threshold.

    Expected endpoint: GET /api/students/attendance
    Query params: section_id, threshold
    Returns: JSON array of student objects
    """
    response = requests.get(
        f"{BASE_URL}/students/attendance",
        params={
            "section_id": section_id,
            "threshold": threshold
        },
        timeout=10
    )
    response.raise_for_status()
    data = response.json()

    return [StudentRecord(**student) for student in data]


def fetch_student_by_id(
    student_id: str,
    section_id: str
) -> Optional[StudentRecord]:
    """
    Calls your Next.js API to get one specific student.

    Expected endpoint: GET /api/students/{student_id}
    Query params: section_id (to confirm they're in the right section)
    Returns: JSON object of one student
    """
    response = requests.get(
        f"{BASE_URL}/students/{student_id}",
        params={"section_id": section_id},
        timeout=10
    )

    if response.status_code == 404:
        return None

    response.raise_for_status()
    data = response.json()

    return StudentRecord(**data)
