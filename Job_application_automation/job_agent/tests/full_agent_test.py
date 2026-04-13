import asyncio
import os
import sys
import logging

# Setup path
_HERE = os.path.dirname(os.path.abspath(__file__))
_JOB_AGENT = os.path.dirname(_HERE)
if _JOB_AGENT not in sys.path:
    sys.path.insert(0, _JOB_AGENT)

from nodes.fetch_job import fetch_job_node
from nodes.extract_fields import extract_fields_node
from nodes.prepare_cv import prepare_cv_node
from nodes.map_fields import map_fields_node
from nodes.fill_form import fill_form_node
from state import JobAgentState

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")

def run_full_test():
    print("\n" + "="*60)
    print("  STARTING FULL AGENT TEST (LOCAL FORM)")
    print("="*60)

    # 1. Initialize State with your local form URL
    state: JobAgentState = {
        "job_url": "http://localhost:3000/job_form",
        "cv_data": {},
        "form_fields": [],
        "form_data": {},
        "cv_path": None
    }

    # 2. Fetch Job Details (Title/Description)
    print("\n[Step 1] Fetching job details...")
    job_res = fetch_job_node(state)
    state.update(job_res)
    print(f"Captured: {state.get('job_title')}")

    # 3. Extract Form Fields
    print("\n[Step 2] Extracting form fields via Browser...")
    field_res = extract_fields_node(state)
    state.update(field_res)
    print(f"Found {len(state.get('form_fields', []))} fields.")

    # 4. Prepare/Load CV
    print("\n[Step 3] Loading CV data and generating PDF...")
    cv_res = prepare_cv_node(state)
    state.update(cv_res)
    print(f"CV Loaded. Path: {state.get('cv_path')}")

    # 5. Map Fields (The Brain)
    print("\n[Step 4] Mapping CV data to Form Fields...")
    map_res = map_fields_node(state)
    state.update(map_res)
    print(f"Generated {len(state.get('form_data', {}))} fill instructions.")

    # 6. Fill Form (The Action)
    print("\n[Step 5] Filling the form in the browser...")
    fill_res = fill_form_node(state)
    print("Fill process completed.")

    print("\n" + "="*60)
    print("  TEST COMPLETED SUCCESSFULLY")
    print("="*60 + "\n")

if __name__ == "__main__":
    run_full_test()
