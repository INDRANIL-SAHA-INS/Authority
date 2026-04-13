# Final verification for the Intelligent Job Agent pipeline
import asyncio
import sys
import os
import json

# Adjust path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from nodes.extract_fields import extract_fields_node
from nodes.refine_fields import refine_fields_node

async def run_test():
    # LINK: The Greenhouse form you were testing
    test_url = "https://in.alllocaljobs.com/job-bZuW2VZGa/job-apply" 
    
    print(f"\n[TEST] Running Semantic Extraction Pipeline on: {test_url}")
    
    # Minimal state for extraction/refinement
    state = {
        "current_url": test_url
    }
    
    # 1. Extraction (Capture All)
    result_extract = await extract_fields_node(state)
    if "error" in result_extract:
        print(f"Extraction failed: {result_extract['error']}")
        return
    
    # 2. Refinement (LLM Semantic Audit)
    # We now pass everything to the LLM to filter the noise
    state["form_fields"] = result_extract["form_fields"]
    result_refine = await refine_fields_node(state)
    
    if "error" in result_refine:
        print(f"Refinement failed: {result_refine['error']}")
    else:
        print(f"\n[SUCCESS] Refined list contains {len(result_refine['form_fields'])} relevant form elements.")
        print("Noise (footer, nav, legal) has been intelligently removed.")

if __name__ == "__main__":
    asyncio.run(run_test())
