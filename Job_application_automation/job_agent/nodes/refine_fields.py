
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
    ("system", """You are a high-precision, deterministic Form Auditor for an autonomous job application agent. 
Your task is to filter a raw list of extracted DOM elements into a strict set of inputs required for a successful submission.

### CORE FILER RULES:
1. **DETERMINISTIC FILTERING**: Treat this as a strict filter, NOT a creative system. Always prioritize whether a field is actually needed to successfully submit the form.
2. **STRICT UTILITY**: Remove anything that does not directly contribute to input, upload, or submission. 
   - KEEP: `input`, `select`, `textarea`, `button[type="submit"]`, custom dropdowns, and file upload zones.
   - REMOVE: Links (`<a>`), spans, divs (unless they are custom inputs), toggle buttons (unless they control form state), and navigation noise.
3. **NOISE SUPPRESSION**: Discard footer links, social media, legal policies, and "back to jobs" type navigation.
4. **NO HALLUCINATION**: Only return `selector` values that exist in the provided input. 
5. **TRICKY CASES**: 
   - Keep custom dropdowns (non-select elements with ARIA roles or data-values).
   - Watch for hidden or dynamically revealed fields that look like they belong to a form step.
   - Watch for autofill UI wrappers that might disguise real inputs.
6. **DEMOGRAPHICS**: Treat questions about Gender, Race, Disability, or Veteran status as `optional_demographic`. Do not remove them if they are inputs, but tag them correctly.
7. **REQUIRED HEURISTICS**: Not all required fields are marked with `*`. Use semantic cues (e.g., "Full Name", "Email", "CV") to infer requirements even if the `required` attribute is missing.
8. **CAPTCHA HANDLING**: If a CAPTCHA is detected (recaptcha, hcaptcha, turnstile), flag it in metadata and keep it in the list.

### EXPECTED JSON FORMAT:
{{
  "form_metadata": {{
    "contains_captcha": boolean,
    "estimated_steps": integer,
    "primary_submit_selector": "string"
  }},
  "fields": [
    {{
      "selector": "#original_selector",
      "field_type": "text | email | file | select | radio | checkbox | submit | captcha",
      "label": "Cleaned Label Text",
      "is_required": boolean,
      "category": "essential | optional_demographic | captcha",
      "reasoning": "Brief explanation"
    }}
  ]
}}
Return ONLY the raw JSON object.
"""),
    ("human", """
RAW DOM ELEMENTS:
{raw_elements}

Analyze and refine the form fields now. Return ONLY the JSON.
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
            "label": el.get("label"),
            "text": el.get("text", "")[:100]
        })

    print(f"      [Step] Requesting audit from the llm")
    
    try:
        # We call the LLM directly as a string first to capture the RAW output
        messages = REFINEMENT_PROMPT.format_messages(raw_elements=json.dumps(compact_list, indent=2))
        
        # We don't use .with_structured_output here yet so we can see the raw text if it fails
        response = await llm2.ainvoke(messages)
        raw_text = response.content
        
        print(f"\n      [RAW LLM OUTPUT] ----------------------------------------------")
        print(raw_text)
        print(f"      ---------------------------------------------------------------\n")

        # Now we try to find the JSON inside the response
        json_match = re.search(r'\{.*\}', raw_text, re.DOTALL)
        if json_match:
            data = json.loads(json_match.group())
            
            # Handle the new "fields" structure or fallback to "selectors"
            field_data = data.get("fields") or data.get("selectors") or data.get("results") or []
            
            # Local mapping to track metadata if needed
            mapping_info = {}
            for item in field_data:
                if isinstance(item, dict) and "selector" in item:
                    mapping_info[item["selector"]] = item
            
            # Filter the original fields, but also enrich them with LLM metadata
            refined_fields = []
            for f in all_fields:
                sel = f.get("selector")
                if sel in mapping_info:
                    # Enrich with LLM tags
                    f["llm_type"] = mapping_info[sel].get("field_type")
                    f["llm_required"] = mapping_info[sel].get("is_required")
                    f["llm_category"] = mapping_info[sel].get("category")
                    f["llm_reasoning"] = mapping_info[sel].get("reasoning")
                    refined_fields.append(f)
            
            print(f"      [Result] Total Raw: {len(all_fields)} | Total Refined: {len(refined_fields)}")
            for i, f in enumerate(refined_fields[:30]): # Show first 30 in console
                label = f.get('label') or f.get('text', '')[:30] or "N/A"
                label = label.replace('\n', ' ').encode('ascii', 'ignore').decode('ascii')
                cat = f.get('llm_category', 'essential')
                req_sym = "*" if f.get('llm_required') else " "
                print(f"        {i+1:2}. [{cat:15}] {req_sym} {label:30} ({f.get('selector')})")

            print("\n[NODE END] ---------------------------------------------------------\n")
            return {
                "form_fields": refined_fields,
                "form_metadata": data.get("form_metadata", {})
            }
        
        else:
            raise ValueError("No JSON found in LLM response.")

    except Exception as e:
        print(f"      [CRITICAL ERROR] Refinement failed: {e}")
        # Return all fields as fallback so the agent doesn't die
        return {"form_fields": all_fields, "error": str(e)}
