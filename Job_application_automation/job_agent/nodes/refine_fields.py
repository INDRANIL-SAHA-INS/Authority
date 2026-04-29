
from __future__ import annotations
import json
import logging
import re
from pydantic import BaseModel, Field
from state import JobAgentState
from config import llm2
from langchain_core.prompts import ChatPromptTemplate

logger = logging.getLogger(__name__)

# ─── Pydantic Schema for Filtering ──────────────────────────────────────────

class RefinedElement(BaseModel):
    """A detailed representation of a relevant form element."""
    selector: str = Field(description="The original selector of the element.")
    field_type: str = Field(description="The semantic type: text, email, file, select, radio, checkbox, submit, or captcha.")
    label: str = Field(description="The cleaned, human-readable label.")
    is_required: bool = Field(description="Heuristic-based requirement status.")
    category: str = Field(description="Category: essential, optional_demographic, or captcha.")
    reasoning: str = Field(description="Deterministic reasoning for keeping this specific element.")

class RefinementResult(BaseModel):
    """The detailed JSON structure for form refinement."""
    form_metadata: dict = Field(default={"contains_captcha": False, "estimated_steps": 1}, description="High-level form analysis.")
    fields: list[RefinedElement] = Field(description="List of elements that survived the filter.")

# ─── Semantic Filter Prompt ───────────────────────────────────────────────

REFINEMENT_PROMPT = ChatPromptTemplate.from_messages([
    ("system", """You are a Noise Filter for a web-based job application form. 
Your goal is to DISCARD UI elements that are irrelevant to filling out and submitting a job application.

### DISCARD (TRASH) LIST:
Remove any element that fits these descriptions:
1. **NAVIGATION**: Main menus, breadcrumbs, "Back to jobs" links, logo links, and search bars.
2. **SOCIAL/MARKETING**: "Follow us" links, share buttons (FB/X), and promotional banners.
3. **CORPORATE NOISE**: "About Us", "Our Culture", "Investors", and non-interactive legal paragraphs (Privacy/Terms) that are NOT checkboxes.
4. **SITE UTILITY**: Language switchers, login/register buttons (for the board, not the form), and newsletter signups.

### RULE:
If an element is likely part of the job application (input, file upload, dropdown, specific question, or the final submit button), DO NOT discard it.

### JSON FORMAT:
{{
  "form_metadata": {{ "contains_captcha": bool, "primary_submit_selector": "string" }},
  "fields": [
    {{
      "selector": "exact_selector_from_input",
      "field_type": "text | email | file | select | radio | checkbox | submit | captcha",
      "label": "Human Label",
      "is_required": bool,
      "category": "essential | optional_demographic | captcha",
      "reasoning": "Why this is NOT noise"
    }}
  ]
}}
Return ONLY JSON.
"""),
    ("human", """
RAW DOM ELEMENTS:
{raw_elements}

Analyze and refine the form fields now. Return ONLY the raw JSON object. NO CONVERSATION.
"""),
])

# ─── Node ─────────────────────────────────────────────────────────────────────

async def refine_fields_node(state: JobAgentState) -> dict:
    print("\n[NODE START] ---> REFINE_FIELDS (LLM Semantic Filter) -----------")
    
    all_fields = state.get("form_fields", [])
    if not all_fields:
        return {"form_fields": []}

    compact_list = []
    for el in all_fields:
        compact_list.append({
            "sel": el.get("selector"),
            "tag": el.get("tagName"),
            "type": el.get("type"), # Added for better identification
            "name": el.get("name"), # Added for better identification
            "label": el.get("label"),
            "text": el.get("text", "")[:100]
        })

    print(f"      [DEBUG] Preparing to process {len(compact_list)} elements in batches...")
    
    BATCH_SIZE = 25
    refined_fields = []
    global_metadata = {"contains_captcha": False, "estimated_steps": 1}
    
    # Use a robust utility to find the JSON root object
    def find_json_object(text: str):
        text = text.strip()
        text = re.sub(r'^```json\s*', '', text, flags=re.MULTILINE)
        text = re.sub(r'\s*```$', '', text, flags=re.MULTILINE)
        starts = [m.start() for m in re.finditer(r'\{', text)]
        for start in starts:
            stack = 0
            for i in range(start, len(text)):
                if text[i] == '{': stack += 1
                elif text[i] == '}': 
                    stack -= 1
                    if stack == 0:
                        candidate = text[start:i+1]
                        try: return json.loads(candidate)
                        except: continue
        return None

    try:
        for i in range(0, len(compact_list), BATCH_SIZE):
            batch = compact_list[i : i + BATCH_SIZE]
            batch_num = (i // BATCH_SIZE) + 1
            print(f"      [Step] Processing Batch #{batch_num} ({len(batch)} elements)...")
            
            messages = REFINEMENT_PROMPT.format_messages(raw_elements=json.dumps(batch, indent=2))
            
            MAX_RETRIES = 2
            data = None
            
            from langchain_core.messages import HumanMessage, AIMessage
            
            for attempt in range(MAX_RETRIES + 1):
                response = await llm2.ainvoke(messages)
                raw_text = response.content
                
                if batch_num == 1: # Only print debug for batch 1 to reduce noise
                    print(f"\n      [DEBUG] RAW LLM OUTPUT (Batch #{batch_num}, Attempt {attempt+1}):")
                    print(raw_text)
                    print("-" * 50)
                
                data = find_json_object(raw_text)
                
                # --- VALIDATION ---
                if data and isinstance(data, dict) and "fields" in data and isinstance(data["fields"], list):
                    break  # Valid JSON and correct schema!
                
                # --- FAILURE REGISTRATION ---
                print(f"      [Warning] Batch #{batch_num} validation failed on attempt {attempt+1}. Asking LLM to fix it...")
                messages.append(AIMessage(content=raw_text))
                messages.append(HumanMessage(content="Your previous response was either invalid JSON or did not match the requested schema (missing 'fields' array). Please correct it and output ONLY the valid JSON object."))
                data = None  # Clear data for the next loop
                
            if not data:
                print(f"      [Error] Batch #{batch_num} exhausted retries and failed to return valid JSON. Skipping.")
                continue

            field_data = data.get("fields") or []
            
            # Map batch results back to original fields
            mapping_info = {item["selector"]: item for item in field_data if isinstance(item, dict) and "selector" in item}
            
            for f in all_fields:
                sel = f.get("selector")
                if sel in mapping_info:
                    f["llm_type"] = mapping_info[sel].get("field_type")
                    f["llm_required"] = mapping_info[sel].get("is_required")
                    f["llm_category"] = mapping_info[sel].get("category")
                    f["llm_reasoning"] = mapping_info[sel].get("reasoning")
                    refined_fields.append(f)
            
            # Update global metadata
            batch_meta = data.get("form_metadata", {})
            if batch_meta.get("contains_captcha"):
                global_metadata["contains_captcha"] = True
            if batch_meta.get("primary_submit_selector"):
                global_metadata["primary_submit_selector"] = batch_meta.get("primary_submit_selector")

        print(f"      [Result] Finished processing. Total Refined: {len(refined_fields)}")
        for i, f in enumerate(refined_fields[:30]):
            label = f.get('label') or f.get('text', '')[:30] or "N/A"
            label = label.replace('\n', ' ').encode('ascii', 'ignore').decode('ascii')
            cat = f.get('llm_category') or 'essential'
            req_sym = "*" if f.get('llm_required') else " "
            print(f"        {i+1:2}. [{cat:15}] {req_sym} {label:30} ({f.get('selector')})")

        print("\n[NODE END] ---------------------------------------------------------\n")
        return {
            "form_fields": refined_fields,
            "form_metadata": global_metadata
        }

    except Exception as e:
        print(f"      [CRITICAL ERROR] Refinement failed: {e}")
        # Return all fields as fallback so the agent doesn't die
        return {"form_fields": all_fields, "error": str(e)}
