from typing import Optional, List, Literal
from enum import Enum
from pydantic import BaseModel, Field

from langchain_community.chat_models import ChatOllama
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import JsonOutputParser, StrOutputParser, PydanticOutputParser
from langchain_core.runnables import RunnableParallel, RunnableBranch, RunnableLambda
from langgraph.graph import StateGraph, START, END

from models import AgentState, StudentQueryModel, QueryType
from api_client import fetch_students_by_threshold, fetch_student_by_id
from email_utils import dispatch_emails_for_student


# ─── LLM Setup ───────────────────────────────────────────────────────────────

llm = ChatOllama(
    model="gemma3:4b",    
    temperature=1.3
)

# Output parser for extraction
parser = PydanticOutputParser(pydantic_object=StudentQueryModel)

EXTRACTION_SYSTEM_PROMPT = """
You are an academic assistant that extracts structured student query information
from a teacher's natural language instruction.

Rules:
- section_id is ALWAYS required. If not mentioned, ask for it (set error).
- If a specific student ID is mentioned, set query_type to "specific_student".
- If the teacher says "all students" or mentions a threshold like "below 85%",
  set query_type to "threshold_based".
- Extract the reason for the email: "attendance", "marks", or "both".
- Default attendance_threshold is 85.0 unless teacher specifies otherwise.
- Default notify_scope is "parents_only" unless teacher says to notify students too.

{format_instructions}

Teacher's Prompt: {prompt}
"""

extraction_prompt = PromptTemplate(
    template=EXTRACTION_SYSTEM_PROMPT,
    input_variables=["prompt"],
    partial_variables={"format_instructions": parser.get_format_instructions()},
)

# Chain for extraction
extraction_chain = extraction_prompt | llm | parser


# ─── NODE 1: Extract structured info from teacher's prompt ───────────────────

def extraction_node(state: AgentState) -> AgentState:
    """
    Uses the local LLM with a parser to fill StudentQueryModel
    from the teacher's raw natural language prompt.
    """
    print("🔍 [Node 1] Extracting structured data from prompt using local Ollama model (gemma3:4b)...")

    try:
        # We need to invoke using the teacher prompt
        query_model: StudentQueryModel = extraction_chain.invoke({"prompt": state.raw_prompt})
        return AgentState(
            **state.model_dump(),
            query_model=query_model,
            status="extracted"
        )
    except Exception as e:
        print(f"   Error in extraction: {e}")
        return AgentState(
            **state.model_dump(),
            error=f"Extraction failed: {str(e)}",
            status="error"
        )


# ─── NODE 2A: Query API for specific student ─────────────────────────────────

def query_specific_student_node(state: AgentState) -> AgentState:
    """
    Calls your Next.js API for a single student by student_id + section_id.
    """
    print("🔎 [Node 2A] Fetching specific student from API...")

    qm = state.query_model
    try:
        # call tool-wrapped function
        student = fetch_student_by_id(student_id=qm.student_id, section_id=qm.section_id)
        if not student:
            return AgentState(
                **state.model_dump(),
                error=f"Student {qm.student_id} not found in section {qm.section_id}.",
                status="error"
            )
        return AgentState(
            **state.model_dump(),
            students=[student],
            status="fetched"
        )
    except Exception as e:
        return AgentState(
            **state.model_dump(),
            error=f"API call failed: {str(e)}",
            status="error"
        )


# ─── NODE 2B: Query API for all students below threshold ─────────────────────

def query_threshold_students_node(state: AgentState) -> AgentState:
    """
    Calls your Next.js API to get all students in the section
    whose attendance is below the threshold.
    """
    print(f"📊 [Node 2B] Fetching students below {state.query_model.attendance_threshold}% in section {state.query_model.section_id}...")

    qm = state.query_model
    try:
        # call tool-wrapped function
        students = fetch_students_by_threshold(section_id=qm.section_id, threshold=qm.attendance_threshold)
        if not students:
            return AgentState(
                **state.model_dump(),
                error=f"No students found below {qm.attendance_threshold}% in section {qm.section_id}.",
                status="error"
            )
        print(f"   Found {len(students)} students.")
        return AgentState(
            **state.model_dump(),
            students=students,
            status="fetched"
        )
    except Exception as e:
        return AgentState(
            **state.model_dump(),
            error=f"API call failed: {str(e)}",
            status="error"
        )


# ─── NODE 3: Dispatch emails ──────────────────────────────────────────────────

def email_dispatch_node(state: AgentState) -> AgentState:
    """
    Iterates through all fetched students and sends emails
    to parents/students depending on notify_scope.
    """
    print(f"📧 [Node 3] Dispatching emails to {len(state.students)} student(s)...")

    qm = state.query_model
    all_sent = []
    all_failed = []

    for student in state.students:
        result = dispatch_emails_for_student(
            student=student,
            notify_scope=qm.notify_scope,
            reason=qm.email_reason or "attendance"
        )
        all_sent.extend(result["sent"])
        all_failed.extend(result["failed"])

    return AgentState(
        **state.model_dump(),
        emails_sent=all_sent,
        emails_failed=all_failed,
        status="done"
    )


# ─── NODE 4: Error handler ────────────────────────────────────────────────────

def error_node(state: AgentState) -> AgentState:
    print(f"🚨 [Error Node] {state.error}")
    return AgentState(**state.model_dump(), status="error")


# ─── ROUTING FUNCTIONS (Conditional Edges) ───────────────────────────────────

def route_after_extraction(
    state: AgentState,
) -> Literal["query_specific_student", "query_threshold_students", "error"]:
    """
    After extraction:
    - If error during extraction → error node
    - If query_type is specific_student → query_specific_student node
    - If query_type is threshold_based → query_threshold_students node
    """
    if state.status == "error" or state.error or not state.query_model:
        return "error"

    if state.query_model.query_type == QueryType.SPECIFIC_STUDENT:
        return "query_specific_student"

    return "query_threshold_students"


def route_after_query(
    state: AgentState,
) -> Literal["email_dispatch", "error"]:
    """
    After DB query:
    - If students list is empty or error → error node
    - Otherwise → email dispatch node
    """
    if state.status == "error" or state.error or not state.students:
        return "error"

    return "email_dispatch"


# ─── BUILD THE LANGGRAPH ──────────────────────────────────────────────────────

def build_graph() -> StateGraph:
    graph = StateGraph(AgentState)

    # ── Add nodes ──
    graph.add_node("extraction",               extraction_node)
    graph.add_node("query_specific_student",   query_specific_student_node)
    graph.add_node("query_threshold_students", query_threshold_students_node)
    graph.add_node("email_dispatch",           email_dispatch_node)
    graph.add_node("error",                    error_node)

    # ── Entry point ──
    graph.add_edge(START, "extraction")

    # ── Conditional routing after extraction ──
    graph.add_conditional_edges(
        "extraction",
        route_after_extraction,
        {
            "query_specific_student":   "query_specific_student",
            "query_threshold_students": "query_threshold_students",
            "error":                    "error",
        }
    )

    # ── Conditional routing after each query node ──
    graph.add_conditional_edges(
        "query_specific_student",
        route_after_query,
        {
            "email_dispatch": "email_dispatch",
            "error":          "error",
        }
    )

    graph.add_conditional_edges(
        "query_threshold_students",
        route_after_query,
        {
            "email_dispatch": "email_dispatch",
            "error":          "error",
        }
    )

    # ── Terminal edges ──
    graph.add_edge("email_dispatch", END)
    graph.add_edge("error",          END)

    return graph.compile()


# ─── Run ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    agent = build_graph()

    # Example 1: Threshold based — all students below 85% in a section
    test_state = AgentState(
        raw_prompt=(
            "Send an email to all students in section CS-3A who have less than "
            "85% attendance. Notify their parents about the attendance drop and "
            "declining marks."
        )
    )
    
    try:
        result = agent.invoke(test_state)

        print("\n── Summary ──")
        print(f"Status        : {result['status']}")
        print(f"Query Detail  : {result['query_model']}")
        print(f"Students found: {len(result['students'])}")
        print(f"Emails sent   : {result['emails_sent']}")
        print(f"Emails failed : {result['emails_failed']}")
        if result.get('error'):
            print(f"Error         : {result['error']}")
    except Exception as e:
        print(f"CRITICAL ERROR: {e}")
