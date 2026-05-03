
from typing import Dict
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import PydanticOutputParser, StrOutputParser
from mail_agent.schema import AgentState, StudentQueryIntent
from mail_agent.utils import fetch_students_by_ids, fetch_students_below_attendance, send_email
from mail_agent.models import llm


def extraction_node(state: AgentState) -> AgentState:
    """
    Uses the LLM with structured output to fill StudentQueryIntent
    from the teacher's raw natural language prompt.
    """
    user_input = state["messages"][-1].content
    context = state.get("context", [])
    
    # Format the context for the LLM to use as a lookup table
    context_info = ""
    if context:
        context_info = "Available Context (use this to map names to IDs):\n"
        for item in context:
            context_info += (
                f"- '{item.subject_name}' -> subject_id: {item.subject_id}, "
                f"section_id: {item.section_id} ({item.section_name})\n"
            )

    pydantic_parser_intent = PydanticOutputParser(pydantic_object=StudentQueryIntent)

    extraction_system_prompt = """
You are an academic assistant that extracts structured student query information
from a teacher's natural language instruction.

{context_info}

CRITICAL RULES:
1. Lookup section_id and subject_id from the 'Available Context' above.
2. If the teacher mentions a subject name (e.g. 'Artificial Intelligence'), you MUST find its corresponding 'subject_id' and 'section_id' from the context table.
3. Return all IDs (subject_id, section_id, student_ids) as STRINGS (e.g. "6", not 6).
4. section_id and subject_id are REQUIRED.

- If one student is mentioned -> set query_type = "single_student"
- If multiple students are mentioned -> set query_type = "multiple_students"
- If teacher says "all students" or "whole class" -> set query_type = "whole_class"
- If threshold like "below 85%" is mentioned -> set query_type = "threshold_based"

- Extract student IDs into "student_ids" as a list of strings.
- Extract reason into "reason": "attendance", "marks", or "both".
- Default attendance_threshold = 85.0 if not specified.

User Input:
{user_input}

Return ONLY valid JSON matching this schema:
{schema}
"""
    prompt_template = PromptTemplate(
        input_variables=["user_input", "context_info"],
        template=extraction_system_prompt,
        partial_variables={"schema": pydantic_parser_intent.get_format_instructions()},
    )

    try:
        chain = prompt_template | llm | pydantic_parser_intent
        result = chain.invoke({"user_input": user_input, "context_info": context_info})
        
        # Validation: If AI failed to find IDs, don't proceed blindly
        if not result.section_id or not result.subject_id:
            state["error"] = "I couldn't identify the class or subject. Please mention them clearly (e.g., 'Artificial Intelligence in Section A')."
            state["status"] = "failed"
            return state

        state["query_intent"] = result
        return state
    except Exception as e:
        print(f"[EXTRACTION ERROR] {e}")
        state["error"] = "Failed to parse the request. Try to be more specific about the subject and section."
        state["status"] = "failed"
        return state


def resolve_targets(state: AgentState) -> AgentState:
    """
    Resolve whether to fetch:
    1. Specific students by ID (if student_ids is provided)
    2. All students below attendance threshold (if student_ids is empty)
    """
    intent = state["query_intent"]
    
    # Extract values directly (Pydantic has already normalized these)
    student_ids = intent.student_ids
    attendance_threshold = intent.attendance_threshold or 85.0
    section_id = intent.section_id
    subject_id = intent.subject_id
    
    # Simplified Validation: Pydantic handles 'null' -> None conversion.
    if not section_id or not subject_id:
        state["error"] = f"Missing required info: section_id({section_id}), subject_id({subject_id})"
        state["status"] = "failed"
        print(f"[VALIDATION FAILED] {state['error']}")
        return state
    
    # Branching Logic
    if student_ids:
        print(f"Fetching specific students: {student_ids}")
        candidates = fetch_students_by_ids(subject_id, section_id, student_ids, attendance_threshold)
    else:
        print(f"Fetching students below {attendance_threshold}% attendance in section {section_id}")
        candidates = fetch_students_below_attendance(subject_id, section_id, attendance_threshold)
    
    state["candidate_students"] = candidates
    state["status"] = "success"
    return state






def send_email_node(state: AgentState) -> AgentState:

    students = state.get("candidate_students", [])

    if not students:
        print("[EMAIL] No students found to send emails to")
        state["emails_sent"] = []
        state["emails_failed"] = []
        state["email_errors"] = []
        state["status"] = "no_students_found"
        return state

    emails_sent = []
    emails_failed = []
    errors = []

    str_parser = StrOutputParser()

    template_for_guardians = PromptTemplate(
        input_variables=["student"],
        template="""
You are an academic assistant writing a formal attendance warning email to a student's parent.

Student Data:
{student}

Rules:
- Address the parent respectfully
- Mention student full name
- Mention attendance percentage
- Mention required threshold
- Mention total classes and attended classes
- Keep tone professional but polite
- Ask them to ensure regular attendance
- End with: "Sincerely, Academic Office"

Write only the email body.
"""
    )
    template_for_students = PromptTemplate(
        input_variables=["student"],
        template="""
You are an academic assistant writing a formal attendance warning email to a student.

Student Data:
{student}

Rules:
- Address the student respectfully
- Mention student full name
- Mention attendance percentage
- Mention required threshold
- Mention total classes and attended classes
- Keep tone professional but polite
- Ask them to ensure regular attendance
- End with: "Sincerely, Academic Office"

Write only the email body.
"""
    )

    chain1 = template_for_guardians | llm | str_parser
    chain2 = template_for_students | llm | str_parser

    print(f"[EMAIL] Starting to send emails to {len(students)} students")
    
    for idx, student in enumerate(students, 1):
        print(f"[EMAIL] Processing student {idx}/{len(students)}: {student.first_name} {student.last_name}")
        
        # Generate email bodies 
        try:
            EACH_student_json = student.model_dump_json()
            email_body_for_guardians = chain1.invoke({"student": EACH_student_json})
            email_body_for_students = chain2.invoke({"student": EACH_student_json})
            subject = f"Attendance Alert for {student.first_name} {student.last_name}"
        except Exception as e:
            error_msg = f"LLM failed for {student.first_name}: {str(e)}"
            errors.append(error_msg)
            continue

        # Send to Guardian
        if student.guardian_email and student.guardian_email.strip():
            try:
                send_email(student.guardian_email, subject, email_body_for_guardians)
                emails_sent.append(student.guardian_email)
            except Exception as e:
                errors.append(f"Guardian error ({student.guardian_email}): {str(e)}")
                emails_failed.append(student.guardian_email)
        
        # Send to Student (Only if email exists)
        if student.email and student.email.strip():
            try:
                send_email(student.email, subject, email_body_for_students)
                emails_sent.append(student.email)
            except Exception as e:
                errors.append(f"Student error ({student.email}): {str(e)}")
                emails_failed.append(student.email)
        else:
            print(f"[EMAIL] Note: Personal email missing for {student.first_name}, only notifying guardian.")

    # Honest Summary Logic
    print(f"[EMAIL] Summary - Sent: {len(emails_sent)}, Failed: {len(emails_failed)}")
    
    state["emails_sent"] = emails_sent
    state["emails_failed"] = emails_failed
    state["email_errors"] = errors

    # If we sent at least one email, we consider it a success for the teacher
    if emails_sent:
        state["status"] = "emails_processed" if not emails_failed else "partial_failure"
    elif not students:
        state["status"] = "no_students_found"
    else:
        state["status"] = "all_emails_failed"

    if errors:
        state["error"] = errors[0]
    
    return state


