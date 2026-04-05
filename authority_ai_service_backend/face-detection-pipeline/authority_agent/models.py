from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from enum import Enum


class QueryType(str, Enum):
    SPECIFIC_STUDENT = "specific_student"
    THRESHOLD_BASED = "threshold_based"


class NotifyScope(str, Enum):
    PARENTS_ONLY = "parents_only"
    STUDENT_ONLY = "student_only"
    BOTH = "both"


# ─── Pydantic Identity Model ──────────────────────────────────────────────────
# The LLM fills this from the teacher's natural language prompt.
# section_id is MANDATORY — everything else is optional.

class StudentQueryModel(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    section_id: str = Field(
        description="The section/class ID (e.g., CS-3A, Section B). Always required."
    )
    student_id: Optional[str] = Field(
        default=None,
        description="Specific student ID (e.g., STU-001) if teacher targets one student."
    )
    student_name: Optional[str] = Field(
        default=None,
        description="Student name if mentioned by the teacher."
    )
    batch: Optional[str] = Field(
        default=None,
        description="Batch number or year if mentioned."
    )
    classroom: Optional[str] = Field(
        default=None,
        description="Classroom number if mentioned."
    )
    attendance_threshold: float = Field(
        default=85.0,
        description="Send email to students BELOW this attendance %. Default is 85."
    )
    query_type: QueryType = Field(
        default=QueryType.THRESHOLD_BASED,
        description="'specific_student' if targeting one student, 'threshold_based' for all below threshold."
    )
    notify_scope: NotifyScope = Field(
        default=NotifyScope.PARENTS_ONLY,
        description="Who to notify: parents_only, student_only, or both."
    )
    email_reason: Optional[str] = Field(
        default=None,
        description="Reason for the email: 'attendance', 'marks', or 'both'. Extracted from prompt."
    )


# ─── Student Record returned from your Next.js API ───────────────────────────

class StudentRecord(BaseModel):
    student_id: str
    name: str
    section_id: str
    attendance_percentage: float
    parent_email: str
    student_email: Optional[str] = None
    marks: Optional[dict] = None          # e.g. {"Math": 45, "Physics": 50}


# ─── LangGraph State ─────────────────────────────────────────────────────────

class AgentState(BaseModel):
    raw_prompt: str                                    # teacher's original message
    query_model: Optional[StudentQueryModel] = None   # filled by LLM
    students: List[StudentRecord] = []                 # fetched from your API
    emails_sent: List[str] = []                        # successful sends
    emails_failed: List[str] = []                      # failed sends
    error: Optional[str] = None
    status: str = "pending"
