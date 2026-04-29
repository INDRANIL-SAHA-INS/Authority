from enum import Enum
from typing import Optional, List, Dict, NotRequired
from pydantic import BaseModel, Field
from langgraph.graph import MessagesState
from enum import Enum
from langgraph.graph import MessagesState

class TargetType(str, Enum):
    SINGLE = "single_student"
    MULTIPLE = "multiple_students"
    WHOLE_CLASS = "whole_class"
    THRESHOLD = "threshold_based"


class EmailReason(str, Enum):
    ATTENDANCE = "attendance"
    MARKS = "marks"
    BOTH = "both"


class NotifyAudience(str, Enum):
    PARENTS = "parents_only"
    STUDENT = "student_only"
    BOTH = "both"



class StudentQueryIntent(BaseModel):
    section_id: Optional[str] = Field(
        default=None,
        description="The section/class ID. Always required."
    )

    student_ids: Optional[List[str]] = Field(
        default=None,
        description="List of student IDs if teacher targets one or multiple students."
    )
    subject_id: Optional[str] = Field(
        default=None,
        description="Subject ID if mentioned."
    )

    batch: Optional[str] = Field(
        default=None,
        description="Batch number or year if mentioned."
    )

    classroom: Optional[str] = Field(
        default=None,
        description="Classroom number if mentioned."
    )

    attendance_threshold: Optional[float] = Field(
        default=85.0,
        description="Send email to students BELOW this attendance %. Default 85."
    )

    query_type: TargetType = Field(
        default=TargetType.THRESHOLD,
        description="Type of query: single, multiple, threshold, or whole class."
    )

    notify_scope: NotifyAudience = Field(
        default=NotifyAudience.PARENTS,
        description="Who to notify: parents_only, student_only, or both."
    )

    reason: EmailReason = Field(
        default=EmailReason.ATTENDANCE,
        description="Reason for email: attendance, marks, or both."
    )



class StudentRecord(BaseModel):
    university_roll_number: str
    first_name: str
    last_name: str
    gender: str
    email: str
    father_name: str
    guardian_email: str
    subject_id: str
    total_sessions: int
    attended_sessions: int
    attendance_percentage: float
    is_short_attendance: bool
    target_threshold: float
    
    @property
    def student_id(self) -> str:
        """Alias for university_roll_number"""
        return self.university_roll_number
    
    @property
    def name(self) -> str:
        """Full name from first_name and last_name"""
        return f"{self.first_name} {self.last_name}"
    
    @property
    def student_email(self) -> str:
        """Alias for email"""
        return self.email
    
    @property
    def parent_email(self) -> str:
        """Alias for guardian_email"""
        return self.guardian_email

class AgentState(MessagesState):
    query_intent: NotRequired[StudentQueryIntent]

    # Step 1 output
    candidate_students: NotRequired[List[StudentRecord]]

    # Step 2 output
    filtered_students: NotRequired[List[StudentRecord]]

    # Step 3 output
    recipients: NotRequired[List[str]]

    # Step 4 output
    emails_sent: NotRequired[List[str]]
    emails_failed: NotRequired[List[str]]
    email_errors: NotRequired[List[str]]

    error: NotRequired[str]
    status: NotRequired[str]
