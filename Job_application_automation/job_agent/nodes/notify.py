# Node to notify user of the result and generate a conversational response
import logging
import json
import os
from datetime import datetime
from state import JobAgentState
from config import llm
from langchain_core.messages import HumanMessage

logger = logging.getLogger(__name__)


# ─── Console / log notification (always runs) ────────────────────────────────

def notify_console(state: JobAgentState):
    """Print a structured summary of the application result to the console."""
    job     = state.get("job_title", "Unknown Role")
    company = state.get("company_name", "Unknown Company")
    status  = "applied" if state.get("applied") else "pending/failed"
    url     = state.get("job_url", "")
    error   = state.get("error", "")
    ts      = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    divider = "─" * 52
    print(f"\n{divider}")
    print(f"  JOB APPLICATION RESULT  [{ts}]")
    print(divider)
    print(f"  Role    : {job}")
    print(f"  Company : {company}")
    print(f"  Status  : {status.upper()}")
    print(f"  URL     : {url}")
    if error:
        print(f"  Error   : {error}")
    print(f"{divider}\n")

    logger.info(f"Application [{status}] — {job} @ {company}")


# ─── File log (appends to applications_log.json) ─────────────────────────────

def notify_log_file(state: JobAgentState, log_path: str = "applications_log.json"):
    """Append result to a local JSON log file so the user has a full history."""
    record = {
        "timestamp"  : datetime.now().isoformat(),
        "job_title"  : state.get("job_title"),
        "company"    : state.get("company_name"),
        "status"     : "applied" if state.get("applied") else "pending/failed",
        "url"        : state.get("job_url"),
        "error"      : state.get("error", ""),
    }

    if os.path.exists(log_path):
        with open(log_path, "r") as f:
            try:
                log = json.load(f)
            except json.JSONDecodeError:
                log = []
    else:
        log = []

    log.append(record)

    with open(log_path, "w") as f:
        json.dump(log, f, indent=2)

    logger.info(f"Result logged to {log_path}")

# ─── Main LangGraph node ──────────────────────────────────────────────────────

def notify_node(state: JobAgentState) -> dict:
    """
    LangGraph node: runs text logs, and generates a conversational LLM summary.
    """
    print("\n[NODE START] ---> NOTIFY ----------------------------")
    notify_console(state)
    notify_log_file(state)

    # Generate a friendly summary for the user using the LLM
    job = state.get("job_title", "Unknown Role")
    company = state.get("company_name", "Unknown Company")
    applied = state.get("applied", False)
    error = state.get("error", "")
    intent = state.get("intent", "full_application")
    
    prompt = f"""
    You are an AI Job Application Assistant communicating directly with the user.
    Based on the following execution state, write a short, friendly, human-like conversational reply (2-3 sentences) summarizing what happened during this run.
    
    Task Intent: {intent}
    Job Title: {job}
    Company: {company}
    Successfully Applied: {applied}
    Error Message (if any): {error}
    
    Rules:
    - If Task Intent is "unrelated", politely explain that you are specialized AI built only for automating job applications and refer to the Error Message.
    - If there was an error during the process, gently explain what went wrong.
    - If Successfully Applied is True, be enthusiastic and confirm the application was sent!
    """
    
    logger.info("Generating LLM user notification...")
    response = llm.invoke([HumanMessage(content=prompt)])
    final_message = response.content.strip()
    
    return {
        "notification": final_message
    }
