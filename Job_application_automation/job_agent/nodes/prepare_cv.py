from state import JobAgentState
from tools.cv_builder import build_cv
import json, os, logging

logger = logging.getLogger(__name__)

ASSETS_DIR   = os.path.join(os.path.dirname(__file__), "..", "assets")
DOCX_CV_PATH = os.path.join(ASSETS_DIR, "base_cv.docx")
JSON_CV_PATH = os.path.join(ASSETS_DIR, "base_cv.json")
# After parsing DOCX, we save extracted data here for debugging + future runs
EXTRACTED_JSON_PATH = os.path.join(ASSETS_DIR, "extracted_cv.json")


from tools.docx_parser import get_cv_data

def _load_cv_data() -> dict:
    """
    Load CV data with priority:
      1. assets/extracted_cv.json (cached result of previous DOCX parse)
      2. assets/base_cv.docx      (parse fresh, then cache to extracted_cv.json)
      3. assets/base_cv.json      (manual structured data)
    """
    return get_cv_data(ASSETS_DIR)


def prepare_cv_node(state: JobAgentState) -> dict:
    print("\n[NODE START] ---> PREPARE_CV ------------------------")
    """
    1. Load CV data from DOCX or JSON.
    2. Store in state.cv_data so ALL downstream nodes can use it.
    3. Build a tailored PDF and store path in state.cv_path.
    """
    try:
        cv_data = _load_cv_data()
    except RuntimeError as e:
        logger.error(str(e))
        return {"cv_data": {}, "cv_path": None, "error": str(e)}

    cv_path = build_cv(
        base_cv=cv_data,
        job_title=state.get("job_title", ""),
        job_description=state.get("job_description", ""),
    )

    return {"cv_data": cv_data, "cv_path": cv_path}