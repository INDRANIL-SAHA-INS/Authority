from state import JobAgentState
import logging

logger = logging.getLogger(__name__)

def navigate_node(state: JobAgentState) -> dict:
    """
    Determines the next URL to visit and updates navigation history.
    This acts as the driver for the web crawler loop.
    """
    print("\n[NODE START] ---> NAVIGATE --------------------------")
    history = state.get("navigation_history") or []
    current_url = state.get("current_url")
    page_type = state.get("page_type")
    
    next_url = None

    # 1. Initial start: we haven't visited any URLs yet.
    if not current_url:
        next_url = state.get("job_url") or state.get("raw_url")
        logger.info(f"Navigation Node: Starting traversal at {next_url}")
        
    # 2. We were on a listing page, and the LLM picked a specific job to click
    elif page_type == "listing" and state.get("chosen_job_url") and state.get("chosen_job_url") != current_url:
        next_url = state.get("chosen_job_url")
        logger.info(f"Navigation Node: Selected job from list -> {next_url}")
    
    # 3. We were on a job description, extracted data, and found an 'Apply' link
    elif page_type == "description" and state.get("apply_url") and state.get("apply_url") != current_url:
        next_url = state.get("apply_url")
        logger.info(f"Navigation Node: Moving from job description to apply page -> {next_url}")
        
    # 4. We are already on an application form, no need to navigate further
    elif page_type == "application_form":
        logger.info("Navigation Node: Arrived at application form. Graph should break out of navigate loop.")
        return {} # Do not update state, graph router will handle exit
        
    # 4. Fallback or generic progression
    else:
        # In a fully headless browser with a persistent context, this node might just 
        # issue a 'page.click(next_button)' command. For our state machine, we manage URLs.
        next_url = current_url
        logger.debug(f"Navigation Node: Remaining on current URL: {next_url}")

    updates = {}

    # Track history if the URL is new
    if next_url and (not history or history[-1] != next_url):
        history_copy = list(history)
        history_copy.append(next_url)
        updates["navigation_history"] = history_copy

    if next_url != current_url:
        updates["current_url"] = next_url
        # When we move to a new URL, reset the page_type so the classifier node runs again
        updates["page_type"] = "unknown" 

    return updates
