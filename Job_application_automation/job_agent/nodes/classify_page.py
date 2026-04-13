from state import JobAgentState
from tools.browser import BrowserManager
from config import llm
from langchain_core.messages import HumanMessage
import asyncio
import logging

logger = logging.getLogger(__name__)

async def _classify(url: str) -> str:
    """Classifies the page into listing, description, or application_form."""
    print("      [Step] Launching Playwright Browser (Visible Mode)...")
    async with BrowserManager(headless=False) as bm:
        page = await bm.new_page()
        try:
            print(f"      [Step] Navigating to {url} (waiting for domcontent to load)...")
            await bm.goto(page, url, wait_until="domcontentloaded")
            print("      [Step] Successfully loaded page. Extracting DOM data...")
        except Exception as e:
            print(f"      [ERROR] Network Timeout or Failure in classify_page: {e}")
            logger.warning(f"Could not load page for classification: {e}")
            return "unknown"
        
        # 1. FAST LOGICAL/HEURISTIC PASS
        url_lower = url.lower()
        
        # Expanded ATS domains and apply-related URL slugs
        ats_patterns = [
            # Top ATS Domains
            "greenhouse.io", "lever.co", "workday", "myworkdayjobs.com", 
            "jobs.ashbyhq.com", "bamboohr.com", "icims.com", "smartrecruiters.com", 
            "workable.com", "jobvite.com", "paylocity.com", "rippling.com", 
            "recruitee.com", "breezy.hr", "freshteam.com", "brassring.com",
            
            # Common Apply URL Patterns
            "/apply", "/application", "/job-apply", "/apply-now", "/application-form", 
            "/submit-application", "/join", "action=apply", "apply=true", "/careers/apply"
        ]
        # Check if URL contains ATS patterns
        has_ats_pattern = False
        for pattern in ats_patterns:
            if pattern in url_lower:
                has_ats_pattern = True
                break

        if has_ats_pattern:
            # Verify with DOM: Application forms have input fields
            num_inputs = await page.locator("input:not([type='hidden'])").count()
            num_forms = await page.locator("form").count()
            if num_inputs > 2 or num_forms > 0:
                logger.info("Heuristic Pass: Classified as 'application_form' based on URL and inputs.")
                return "application_form"
                
        title = await page.title()
        
        # Checking Description patterns
        desc_patterns = ["/job/", "/careers/", "/role/", "/position/"]
        # Check if URL contains Description patterns
        has_desc_pattern = False
        for pattern in desc_patterns:
            if pattern in url_lower:
                has_desc_pattern = True
                break

        if has_desc_pattern:
            num_inputs = await page.locator("input:not([type='hidden'])").count()
            # Job descriptions might have an Apply button but usually lack large forms
            if num_inputs <= 2:
                logger.info("Heuristic Pass: Classified as 'description' based on URL and lack of forms.")
                return "description"

        # 2. LLM FALLBACK CHECK
        logger.info("Heuristics unclear. Performing LLM fallback classification.")
        body_text = await page.inner_text("body")
        
        prompt = f"""
        Analyze the following webpage's title, URL, and partial body text to determine its page type.
        
        URL: {url}
        Title: {title}
        
        Body Content Snippet:
        {body_text[:2000]}
        
        You must respond with EXACTLY ONE of these words and absolutely nothing else:
        listing
        description
        application_form
        unknown
        """
        
        response = llm.invoke([HumanMessage(content=prompt)])
        result = response.content.strip().lower()
        
        valid_types = ["listing", "description", "application_form", "unknown"]
        if result in valid_types:
            logger.info(f"LLM Fallback Classified as: '{result}'")
            return result
            
        return "unknown"

def classify_page_node(state: JobAgentState) -> dict:
    print("\n[NODE START] ---> CLASSIFY_PAGE ---------------------")
    current_url = state.get("current_url")
    if not current_url:
        return {"page_type": "unknown"}
        
    page_type = asyncio.run(_classify(current_url))
    return {"page_type": page_type}
