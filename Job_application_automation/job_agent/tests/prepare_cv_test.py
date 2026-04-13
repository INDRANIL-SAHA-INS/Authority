import os
import sys
import logging
import json

# Setup path to find job_agent modules
_HERE = os.path.dirname(os.path.abspath(__file__))
_JOB_AGENT = os.path.dirname(_HERE)
if _JOB_AGENT not in sys.path:
    sys.path.insert(0, _JOB_AGENT)

from nodes.prepare_cv import prepare_cv_node
from state import JobAgentState

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

def test_prepare_cv():
    print("\n" + "="*60)
    print("  TESTING PREPARE_CV_NODE")
    print("="*60)

    # 1. Initialize State with dummy job data
    state = {
        "job_title": "Senior Python Developer",
        "job_description": (
            "We are looking for a Python expert with Experience in LangGraph, "
            "LLMs, and automated browser testing. Should have 5+ years experience."
        ),
        "cv_data": {},
        "cv_path": None
    }

    print(f"Target Job: {state['job_title']}")
    print("Running prepare_cv_node...")

    # 2. Execute Node
    # This will load CV from extracted_cv.json, base_cv.docx, or base_cv.json
    result = prepare_cv_node(state)

    # 3. Validation
    if result.get("error"):
        print(f"\n[FAIL] Node returned an error: {result['error']}")
        return

    cv_data = result.get("cv_data", {})
    cv_path = result.get("cv_path")

    if not cv_data:
        print("\n[FAIL] No CV data returned in state.")
    else:
        print(f"\n[PASS] CV data loaded for: {cv_data.get('name', 'Unknown')}")
        print(f"       Experience count: {len(cv_data.get('experience', []))}")
        print(f"       Skills count:     {len(cv_data.get('skills', []))}")

    if not cv_path or not os.path.exists(cv_path):
        print("\n[FAIL] Tailored PDF path is missing or file was not created.")
    else:
        print(f"\n[PASS] Tailored PDF generated at: {cv_path}")
        print(f"       File size: {os.path.getsize(cv_path)} bytes")
        
    print("\n" + "="*60 + "\n")

if __name__ == "__main__":
    try:
        test_prepare_cv()
    except Exception as e:
        logger.exception(f"Test crashed with error: {e}")
