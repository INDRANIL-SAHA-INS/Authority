from __future__ import annotations
from state import JobAgentState
from config import llm
from pydantic import BaseModel, Field
import json
import logging
import os
from langchain_core.prompts import ChatPromptTemplate
from tools.docx_parser import get_cv_data

logger = logging.getLogger(__name__)

ASSETS_DIR = os.path.join(os.path.dirname(__file__), "..", "assets")

# ─── Pydantic Schema ──────────────────────────────────────────────────────────

class FieldAction(BaseModel):
    """A specific interaction needed to fill one part of the form."""
    selector: str = Field(description="The CSS selector for the element.")
    action: str = Field(description="Action: 'type', 'select_option', 'check', 'upload_cv', 'click', 'click_radio'")
    value: str = Field(description="The value to use. For 'upload_cv', use '__CV_PATH__'.")
    reasoning: str = Field(description="Brief explanation of why this element was chosen (e.g., 'Identified as First Name input').")

class FormFillPlan(BaseModel):
    """The complete mapping of CV data to the detected form elements."""
    actions: list[FieldAction] = Field(description="List of calculated actions for the application.")

# ─── The Semantic Planner Prompt ──────────────────────────────────────────────

PLANNING_PROMPT = ChatPromptTemplate.from_messages([
    ("system", """You are an expert Web Automation Planner. 
Your task is to analyze a raw list of interactive elements from a webpage and identify which ones are part of the actual job application form.

CRITICAL INSTRUCTIONS:
1. SEMANTIC FILTERING: You will receive 50-100 elements. Most are noise (Nav, Footer, Legal). Your first job is to ignore them.
2. REACT/MODERN UI: Identifying inputs is not enough. You must look for DIVs, SPANS, and BUTTONS that act as fields (e.g. 'Toggle flyout' for a dropdown, or a DIV labeled 'Resume').
3. COMPREHENSIVE FILLING: Fill everything that seems logical based on the User's CV. This includes custom questions, diversity sections, and social links.
4. ACTION TYPES:
   - 'type': For text boxes, textareas, contenteditable.
   - 'select_option': For standard select tags or custom dropdowns (provide the value).
   - 'click_radio': For radio buttons or groups.
   - 'check': For checkboxes.
   - 'upload_cv': Use ONLY for the primary resume/CV upload field. Use value '__CV_PATH__'.
   - 'click': For standard buttons that need to be pressed (like 'Submit').

5. FOR TEXTAREAS: If a question is asked (e.g. 'Why do you want to work here?'), draft a 3-4 sentence professional response using the user's experience and the job description.

NEVER invent selectors. Use only the 'sel' strings provided in the input objects."""),
    ("human", """
USER CV DATA:
{user_cv}

JOB CONTEXT:
Job Title: {job_title}
Requirements: {job_desc}

RAW EXTRACTED ELEMENTS:
{raw_elements}

Analyze ALL elements and produce the complete FormFillPlan. Ignore navigation and legal noise."""),
])

# ─── Node ─────────────────────────────────────────────────────────────────────

async def map_fields_node(state: JobAgentState) -> dict:
    print("\n[NODE START] ---> MAP_FIELDS (Semantic Intelligence) --------------")
    
    raw_elements = state.get("form_fields", [])
    cv_data = state.get("cv_data")

    # Fallback to load CV data if not in state
    if not cv_data:
        try:
            cv_data = get_cv_data(ASSETS_DIR)
        except:
            cv_data = {}
    
    if not raw_elements:
        return {"error": "No elements found to plan with."}

    # Prepare a compact version of the elements to save tokens and focus the LLM
    compact_elements = []
    for el in raw_elements:
        compact_elements.append({
            "sel": el.get("selector"),
            "tag": el.get("tagName"),
            "type": el.get("type"),
            "label": el.get("label"),
            "text": el.get("text", "")[:150], # Include text context
        })

    # Initialize the structured LLM
    structured_llm = llm.with_structured_output(FormFillPlan)

    try:
        print(f"      [Step] Feeding {len(compact_elements)} raw elements to LLM for Intelligent Planning...")
        
        messages = PLANNING_PROMPT.format_messages(
            user_cv=json.dumps(cv_data, indent=2),
            job_title=state.get("job_title", "Unknown"),
            job_desc=(state.get("job_description") or "")[:2000],
            raw_elements=json.dumps(compact_elements, indent=2)
        )
        
        # Invoke LLM
        result: FormFillPlan = structured_llm.invoke(messages)
        
        actions = result.actions
        print(f"      [Step] LLM identified {len(actions)} relevant actions and ignored the noise.")
        
        # Format the result back into the state's form_data
        form_data = {}
        for action in actions:
            # Preview for console
            val_preview = (str(action.value)[:50] + "...") if len(str(action.value)) > 50 else str(action.value)
            print(f"        -> {action.action.upper()}: {action.selector} | Reasoning: {action.reasoning}")
            
            form_data[action.selector] = {
                "action": action.action,
                "value": action.value
            }

        return {"form_data": form_data, "planned_actions": actions, "form_ready": True}

    except Exception as e:
        print(f"      [ERROR] Planning failed: {e}")
        return {"error": str(e)}
