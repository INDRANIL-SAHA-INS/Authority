from tools.browser import BrowserManager
from state import JobAgentState
from config import llm
from langchain_core.messages import HumanMessage
import asyncio
import logging

logger = logging.getLogger(__name__)

async def _extract_jd(url: str) -> dict:
    print("      [Step] Launching Playwright Browser (Visible Mode)...")
    async with BrowserManager(headless=False) as bm:
        page = await bm.new_page()
        try:
            print(f"      [Step] Navigating to {url} (waiting for domcontent to load)...")
            await bm.goto(page, url, wait_until="domcontentloaded")
            print("      [Step] Successfully loaded description page. Parsing text...")
        except Exception as e:
            print(f"      [ERROR] Network Timeout or Failure in extract_job_details: {e}")
            raise Exception(f"Failed to load description page: {e}")
        
        title = await page.title()
        body_text = await page.inner_text("body")
        
        # Look for apply button/link to save for navigation
        apply_url = None
        for selector in [
            'a:has-text("Apply")', 
            'a:has-text("Apply Now")', 
            'button:has-text("Apply")', 
            'a[href*="apply"]'
        ]:
            el = page.locator(selector).first
            if await el.count() > 0:
                href = await el.get_attribute("href")
                if href:
                    # Resolve relative URLs
                    apply_url = href if href.startswith("http") else url.rstrip("/") + "/" + href.lstrip("/")
                    break

        return {
            "title": title,
            "body": body_text[:6000],  # Give LLM solid context
            "apply_url": apply_url,
        }

def extract_job_details_node(state: JobAgentState) -> dict:
    print("\n[NODE START] ---> EXTRACT_JOB_DETAILS ---------------")
    current_url = state.get("current_url")
    if not current_url:
        return {"error": "No current_url for description extraction."}
        
    result = asyncio.run(_extract_jd(current_url))

    # We ask the LLM to structure the extracted text
    response = llm.invoke([
        HumanMessage(content=f"""
From this job description page content, extract comprehensive details.

Content: {result['body']}

Respond EXACTLY in this format, and use multiple lines if necessary for descriptions/bullets.
job_title: <exact title>
company_name: <company name>
job_description: <detailed summary of the role>
requirements: <bullet points of requirements>
benefits: <bullet points of benefits>
""")
    ])

    lines = response.content.strip().splitlines()
    parsed = {}
    current_key = "job_description"
    
    # Simple state machine to parse multi-line responses
    for line in lines:
        if ":" in line and not line.startswith(" ") and not line.startswith("-"):
            potential_key = line.split(":", 1)[0].strip()
            if potential_key in ["job_title", "company_name", "job_description", "requirements", "benefits"]:
                current_key = potential_key
                parsed[current_key] = line.split(":", 1)[1].strip() + "\n"
                continue
        
        if current_key in parsed:
            parsed[current_key] += line + "\n"

    # Cleanup whitespaces
    for k in parsed:
        parsed[k] = parsed[k].strip()

    updates = {
        "job_title": parsed.get("job_title", result["title"]),
        "company_name": parsed.get("company_name"),
        "job_description": parsed.get("job_description"),
        "extracted_job_details": {
            "requirements": parsed.get("requirements", ""),
            "benefits": parsed.get("benefits", "")
        }
    }
    
    # Crucial: Store the apply link if we found one, so navigate_node knows where to go
    if result["apply_url"]:
        updates["apply_url"] = result["apply_url"]
        
    logger.info(f"Extracted Job Details for: {updates.get('job_title')}")
    return updates
