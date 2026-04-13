from tools.browser import BrowserManager
from state import JobAgentState
from config import llm
from langchain_core.messages import HumanMessage
import asyncio
import logging
import json

logger = logging.getLogger(__name__)

async def _find_best_job(url: str, user_title_preference: str) -> str:
    """Extracts links from the listing page and uses the LLM to pick the best matching job URL."""
    print("      [Step] Launching Playwright Browser (Visible Mode)...")
    async with BrowserManager(headless=False) as bm:
        page = await bm.new_page()
        try:
            await bm.goto(page, url, wait_until="domcontentloaded")
        except Exception as e:
            logger.error(f"Failed to load listing page: {e}")
            return ""
        
        # Inject JavaScript to extract all hyperlinks with text using a beginner-friendly loop
        links = await page.evaluate('''() => {
            let allLinks = Array.from(document.querySelectorAll('a'));
            let goodLinks = [];
            
            for (let i = 0; i < allLinks.length; i++) {
                let el = allLinks[i];
                let text = el.innerText.trim();
                let href = el.href;
                
                // Keep the link if it has a normal text name and is not a login/signup page
                if (text.length > 3 && href.startsWith('http') && !href.includes('login') && !href.includes('signup')) {
                    goodLinks.push({ text: text, href: href });
                }
            }
            return goodLinks;
        }''')
        
    if not links:
        logger.warning("No interactive links found on listing page.")
        return ""
        
    # Ask the LLM to pick the best link based on user intent
    # We slice to grab only the first 100 links to avoid blowing up the token context window
    prompt = f"""
    You are an intelligent job scraper. Determine which URL the user should click next.
    Given this list of links found on a job board/career listing page, identify the ONE link that points to a specific job posting.
    
    User's Search Preference: "{user_title_preference}"
    
    Instructions:
    1. Look for jobs that match the Search Preference.
    2. If there are no perfect matches, default to selecting the first Engineering or Tech related role.
    3. Ignore links that lead to terms of service, privacy policies, or home pages.
    
    Links List (Title and URL):
    {json.dumps(links[:100], indent=2)}
    
    You must respond with EXACTLY ONE URL string and nothing else. If absolutely none of the links look like job postings, reply with the word "none".
    """
    
    logger.info("Asking LLM to pick the best job link from the listing...")
    response = llm.invoke([HumanMessage(content=prompt)])
    result = response.content.strip()
    
    if result.startswith("http"):
        return result
    return ""

def extract_listing_node(state: JobAgentState) -> dict:
    print("\n[NODE START] ---> EXTRACT_LISTING -------------------")
    current_url = state.get("current_url")
    if not current_url:
        return {}
        
    # Try to grab the initial user prompt. If missing, default to typical engineer searches.
    preference = state.get("raw_prompt") or "Software Engineer / Developer / Tech Agent"
    
    best_link = asyncio.run(_find_best_job(current_url, preference))
    
    if best_link:
        logger.info(f"Extract Listing Node: LLM Selected Job URL -> {best_link}")
        return {"chosen_job_url": best_link}
        
    logger.warning("Extract Listing Node: LLM failed to identify a job link.")
    return {}
