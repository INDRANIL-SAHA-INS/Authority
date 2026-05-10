import json
from .models import llm
from langchain_core.prompts import ChatPromptTemplate
from pydantic import BaseModel, Field
from typing import List, Dict

class ColumnMapping(BaseModel):
    marks_obtained_key: str = Field(description="The JSON key in the raw data that represents the total final marks obtained.")
    student_identifier_key: str = Field(description="The JSON key that represents the student's USN or University Roll Number.")

class SubMarkMapping(BaseModel):
    raw_key: str = Field(description="The raw JSON key for a sub-part (e.g. 'quiz_10_marks').")
    meaningful_name: str = Field(description="A clean, PascalCase name for this component (e.g. 'Quiz').")

class DiscoveryMapping(BaseModel):
    column_routing: ColumnMapping
    sub_parts: List[SubMarkMapping]

SYSTEM_PROMPT = """
You are a Database Schema Discovery agent. Your task is to analyze raw student marks data and map it to a fixed database schema.

DATABASE SCHEMA CONTEXT:
- Fixed Columns: 'marks_obtained' (Total score), 'student_identifier' (USN/Roll Number).
- Dynamic JSON: 'sub_marks' (Breakdown of components like Quiz, Assignment).

RULES:
1. Identify which raw key represents the TOTAL final marks.
2. Identify which raw key represents the student's unique USN/Roll Number.
3. Identify all other numeric keys as 'sub-parts'.
4. For sub-parts, create clean, PascalCase 'meaningful_name's (e.g., 'assignment_10_marks' -> 'Assignment').
5. Ignore keys like 'sno', 'sl_no', or 'student_name'.
6. Return ONLY a valid JSON object.
"""

USER_PROMPT_TEMPLATE = """
METADATA:
{metadata}

SAMPLE RECORDS:
{samples}

Return the mapping in the following structure:
{{
  "column_routing": {{
    "marks_obtained_key": "...",
    "student_identifier_key": "..."
  }},
  "sub_parts": [
    {{ "raw_key": "...", "meaningful_name": "..." }},
    ...
  ]
}}
"""

def get_schema_mapping(metadata: dict, records: list) -> dict:
    """
    Calls the local Ollama model to discover the mapping between raw keys and canonical DB fields.
    """
    # We only need the first 2 records for discovery
    samples = records[:2]
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", SYSTEM_PROMPT),
        ("user", USER_PROMPT_TEMPLATE)
    ])
    
    chain = prompt | llm
    
    response = chain.invoke({
        "metadata": json.dumps(metadata),
        "samples": json.dumps(samples)
    })
    
    # Since we set format="json" in ChatOllama, the content should be a JSON string
    try:
        mapping = json.loads(response.content)
        return mapping
    except Exception as e:
        print(f"Error parsing AI mapping: {e}")
        return {}
