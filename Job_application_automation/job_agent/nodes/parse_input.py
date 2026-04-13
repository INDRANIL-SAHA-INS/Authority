# Node to parse URL and prompt intent
from langchain_core.messages import HumanMessage
from config import llm
from state import JobAgentState
import re

def parse_input_node(state: JobAgentState) -> dict:
    print("\n[NODE START] ---> PARSE_INPUT -----------------------")
    prompt = state.get("raw_prompt", "")
    url = state.get("raw_url", "")

    # Extract URL if embedded in prompt
    url_match = re.search(r'https?://\S+', prompt)
    if not url and url_match:
        url = url_match.group(0)

    # Ask LLM to determine intent
    response = llm.invoke([
        HumanMessage(content=f"""
Given this user request: "{prompt}"
Determine the intent. Reply with ONLY one of:
- full_application (User wants to apply to a job, view a listing, or process a URL)
- unrelated (User is asking a general question, asking for code help, or something unrelated to job automation)
""")
    ])

    intent_raw = response.content.strip().lower()
    intent = "full_application" if "full" in intent_raw else "unrelated"

    updates = {
        "job_url": url,
        "raw_url": url,
        "intent": intent,
    }
    
    if intent == "unrelated":
        updates["error"] = "I am an AI agent designed exclusively to automate job applications. I cannot assist with unrelated requests."
        
    return updates
