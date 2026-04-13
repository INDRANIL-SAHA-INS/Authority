# LangGraph graph definition and edges
from langgraph.graph import StateGraph, END
from state import JobAgentState
from nodes.parse_input import parse_input_node
from nodes.navigate import navigate_node
from nodes.classify_page import classify_page_node
from nodes.extract_job_details import extract_job_details_node
from nodes.extract_listing import extract_listing_node
from nodes.extract_fields import extract_fields_node
from nodes.prepare_cv import prepare_cv_node
from nodes.map_fields import map_fields_node
from nodes.fill_form import fill_form_node
from nodes.notify import notify_node

def route_after_parse(state: JobAgentState) -> str:
    if state.get("intent") == "unrelated":
        return "notify"
    return "navigate"

def route_after_classify(state: JobAgentState) -> str:
    page_type = state.get("page_type")
    
    if page_type == "description":
        return "extract_job_details"
    elif page_type == "application_form":
        return "extract_fields"
    elif page_type == "listing":
        return "extract_listing"
    else:
        # Fallback for unknown: try to extract fields anyway.
        # This breaks infinite loops if the page type isn't perfectly recognized.
        return "extract_fields"

def route_after_fields(state: JobAgentState) -> str:
    # Get the list of all fields found on the page
    form_fields = state.get("form_fields", [])
    
    # Check if any of those fields is a file upload
    has_upload = False
    for field in form_fields:
        field_type = field.get("type")
        if field_type == "file":
            has_upload = True
            break  # We found one, so we can stop searching

    # If an upload button is found, detour to generate the CV PDF first
    if has_upload == True:
        return "prepare_cv"
    
    # Otherwise, skip generating the PDF and just map the text fields
    return "map_fields"

builder = StateGraph(JobAgentState)

builder.add_node("parse_input", parse_input_node)
builder.add_node("navigate", navigate_node)
builder.add_node("classify_page", classify_page_node)
builder.add_node("extract_job_details", extract_job_details_node)
builder.add_node("extract_listing", extract_listing_node)

builder.add_node("extract_fields", extract_fields_node)
builder.add_node("prepare_cv", prepare_cv_node)
builder.add_node("map_fields", map_fields_node)
builder.add_node("fill_form", fill_form_node)
builder.add_node("notify", notify_node)

builder.set_entry_point("parse_input")

builder.add_conditional_edges("parse_input", route_after_parse, {
    "navigate": "navigate",
    "notify": "notify",
})

# Cyclic router starts here
builder.add_edge("navigate", "classify_page")

builder.add_conditional_edges("classify_page", route_after_classify, {
    "extract_job_details": "extract_job_details",
    "extract_fields": "extract_fields",
    "extract_listing": "extract_listing",
    "navigate": "navigate", 
})

# After getting JD we loop back and try to navigate to the Apply link
builder.add_edge("extract_job_details", "navigate")

# After scanning a listing page, we loop back to navigate to the exact job link
builder.add_edge("extract_listing", "navigate")

# Once at the application form, flow continues linearly
builder.add_conditional_edges("extract_fields", route_after_fields, {
    "prepare_cv": "prepare_cv",
    "map_fields": "map_fields",
})

builder.add_edge("prepare_cv", "map_fields")

def route_after_fill(state: JobAgentState) -> str:
    # If the form submit failed (e.g. multi-step next button clicked), loop back to extract the new page fields
    if state.get("applied"):
        return "notify"
    return "extract_fields"

builder.add_edge("map_fields", "fill_form")
builder.add_conditional_edges("fill_form", route_after_fill, {
    "notify": "notify",
    "extract_fields": "extract_fields"
})
# builder.add_edge("fill_form", "notify")  -- Refactored out for Multi-Step tracking
builder.add_edge("notify", END)

graph = builder.compile()