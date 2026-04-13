from __future__ import annotations

"""
docx_parser.py
Extracts CV data from a .docx file into a normalized dict.

Why no fixed Pydantic model for extraction:
  Every CV is structured differently. A rigid schema will either fail (field missing)
  or silently drop data (field not in schema). Instead we let the LLM do open-ended
  extraction into a flexible dict, then NORMALIZE the result to guarantee the minimum
  keys that the rest of the pipeline needs.

Guaranteed output keys (always present, may be empty):
  name, email, phone, location, linkedin, github,
  summary, skills (list), experience (list[dict]), education (list[dict]),
  projects (list[dict]), certifications (list[str]),
  cover_letter (str), extra (dict — anything else the LLM found)
"""

from docx import Document
from config import llm
from langchain_core.messages import SystemMessage, HumanMessage
import os, json, logging, re

logger = logging.getLogger(__name__)

# Minimum keys the pipeline depends on — always present after normalization
REQUIRED_KEYS = {
    "name":           "",
    "email":          "",
    "phone":          "",
    "location":       "",
    "linkedin":       "",
    "github":         "",
    "summary":        "",
    "skills":         [],
    "experience":     [],
    "education":      [],
    "projects":       [],
    "certifications": [],
    "cover_letter":   "",
    "extra":          {},
}


# ─── High-Level API ───────────────────────────────────────────────────────────

def get_cv_data(assets_dir: str) -> dict:
    """
    Returns normalized CV data with priority:
      1. assets/extracted_cv.json (cached result of previous DOCX parse)
      2. assets/base_cv.docx      (parse fresh, then cache to extracted_cv.json)
      3. assets/base_cv.json      (manual structured data)

    Guarantees all REQUIRED_KEYS are present.
    """
    docx_path = os.path.join(assets_dir, "base_cv.docx")
    cache_path = os.path.join(assets_dir, "extracted_cv.json")
    json_path = os.path.join(assets_dir, "base_cv.json")

    # 1 & 2: Check for cache or parse DOCX
    if os.path.exists(docx_path) or os.path.exists(cache_path):
        logger.info("Retrieving CV via DOCX/Cache pipeline.")
        return load_cv_from_docx(docx_path, cache_path=cache_path)

    # 3: Fallback to manual JSON
    if os.path.exists(json_path):
        logger.info(f"Using manual CV source: {json_path}")
        with open(json_path, encoding="utf-8") as f:
            data = json.load(f)
            return _normalize(data)

    raise RuntimeError(
        "No CV source found in assets. Please provide one of:\n"
        f"  {docx_path}  (auto-parsed)\n"
        f"  {json_path}  (manual JSON)"
    )


# ─── DOCX Text Extraction ─────────────────────────────────────────────────────

def extract_raw_text(docx_path: str) -> str:
# ... (rest of the file remains same)
    """
    Pull all text from the .docx preserving reading order.
    Handles both paragraphs and tables (experience/edu tables are common in CV templates).
    """
    doc = Document(docx_path)
    lines = []

    WNS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"

    for element in doc.element.body:
        tag = element.tag.split("}")[-1]

        if tag == "p":
            text = "".join(element.itertext()).strip()
            if text:
                lines.append(text)

        elif tag == "tbl":
            for row in element.iter(f"{{{WNS}}}tr"):
                cells = []
                for cell in row.iter(f"{{{WNS}}}tc"):
                    cell_text = "".join(cell.itertext()).strip()
                    if cell_text:
                        cells.append(cell_text)
                if cells:
                    lines.append("  |  ".join(cells))

    return "\n".join(lines)


# ─── LLM Open-Ended Extraction ────────────────────────────────────────────────

_SYSTEM = """You are a CV data extractor.

Given raw text from a CV, extract ALL information into a JSON object.
Use these key names where the information exists:
  name, email, phone, location, linkedin, github,
  summary, skills (array of strings),
  experience (array of objects: company, title, location, start, end, bullets[]),
  education (array of objects: institution, degree, field, gpa, year),
  projects (array of objects: name, description, tech[]),
  certifications (array of strings),
  cover_letter

If there are any other fields or sections in the CV that don't fit the above,
put them inside an "extra" object with descriptive keys.

RULES:
- Extract ONLY what is present in the text — do not fabricate anything.
- For dates, use the format as found in the document (do not normalize).
- skills must be a flat array of individual skill strings.
- Return ONLY the JSON object, no markdown fences, no explanation."""

def _extract_with_llm(raw_text: str) -> dict:
    """
    Ask the LLM to freely extract whatever structure it finds in the CV text.
    Falls back to empty dict if LLM fails.
    """
    try:
        response = llm.invoke([
            SystemMessage(content=_SYSTEM),
            HumanMessage(content=f"CV TEXT:\n{raw_text}"),
        ])
        content = response.content.strip()

        # Strip accidental markdown code fences
        content = re.sub(r"^```[a-z]*\n?", "", content)
        content = re.sub(r"\n?```$", "", content)

        extracted = json.loads(content)
        if not isinstance(extracted, dict):
            raise ValueError("LLM returned non-dict JSON")
        return extracted

    except json.JSONDecodeError as e:
        logger.warning(f"LLM returned invalid JSON: {e}. Returning empty dict.")
        return {}
    except Exception as e:
        logger.error(f"LLM extraction failed: {e}")
        return {}


# ─── Normalization ────────────────────────────────────────────────────────────

def _normalize(raw: dict) -> dict:
    """
    Merge LLM-extracted data onto the required key skeleton.
    This guarantees downstream nodes never get a KeyError.
    """
    result = dict(REQUIRED_KEYS)  # start from skeleton

    for key, default in REQUIRED_KEYS.items():
        value = raw.get(key, default)

        # Type-check and coerce
        if isinstance(default, list) and not isinstance(value, list):
            value = [value] if value else []
        elif isinstance(default, dict) and not isinstance(value, dict):
            value = {}
        elif isinstance(default, str) and not isinstance(value, str):
            value = str(value) if value else ""

        result[key] = value

    # Anything the LLM extracted that isn't a standard key → goes into extra
    for key, value in raw.items():
        if key not in REQUIRED_KEYS:
            result["extra"][key] = value

    return result


# ─── Public API ──────────────────────────────────────────────────────────────

def load_cv_from_docx(docx_path: str, cache_path: str | None = None) -> dict:
    """
    Parse a .docx CV file into a normalized dict compatible with
    build_cv() and map_fields_node().

    If cache_path is provided and the file exists, it loads the JSON directly.
    Otherwise it parses the DOCX, saves the result to cache_path (if provided),
    and returns the dict.

    Returns a dict with all REQUIRED_KEYS always present.
    Raises RuntimeError only if the file cannot be read and no cache is available.
    """
    if cache_path and os.path.exists(cache_path):
        logger.info(f"Loading cached CV from JSON: {cache_path}")
        try:
            with open(cache_path, "r", encoding="utf-8") as f:
                cached = json.load(f)
            # Still run through normalization to ensure schema compliance
            return _normalize(cached)
        except Exception as e:
            logger.warning(f"Failed to load cache from '{cache_path}': {e}. Falling back to DOCX.")

    if not os.path.exists(docx_path):
        raise RuntimeError(f"DOCX CV file not found at: {docx_path}")

    logger.info(f"Extracting text from DOCX: {docx_path}")
    raw_text = extract_raw_text(docx_path)

    if not raw_text.strip():
        raise RuntimeError(f"DOCX at '{docx_path}' appears empty or has no extractable text.")

    logger.info(f"Extracted {len(raw_text)} chars. Sending to LLM for structured extraction.")
    extracted = _extract_with_llm(raw_text)

    normalized = _normalize(extracted)

    if cache_path:
        try:
            with open(cache_path, "w", encoding="utf-8") as f:
                json.dump(normalized, f, indent=2)
            logger.info(f"Parsed CV saved to cache: {cache_path}")
        except Exception as e:
            logger.warning(f"Failed to save CV cache to '{cache_path}': {e}")

    logger.info(
        f"Parsed CV — name: '{normalized['name']}', "
        f"jobs: {len(normalized['experience'])}, "
        f"skills: {len(normalized['skills'])}"
    )
    return normalized
