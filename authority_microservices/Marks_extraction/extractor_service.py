import os
import re
from .pdf_processor import process_multipage_pdf
from .csv_excel_processor import process_spreadsheet

def normalize_key(key: str) -> str:
    """
    Normalizes a header string to be a consistent dictionary key.
    e.g., 'Total (20 marks)' -> 'total_20_marks'
    """
    if not isinstance(key, str):
        key = str(key)
    key = key.lower()
    key = re.sub(r'[\s\(\)\[\]\{\}\.\-\+\/\\]+', '_', key)
    key = key.strip('_')
    return key

def _normalize_records(raw_records: list) -> list:
    """Normalize keys and cast numeric strings for a list of raw row dicts."""
    normalized = []
    for row in raw_records:
        normalized_row = {}
        is_empty = True
        for key, value in row.items():
            norm_key = normalize_key(key)
            if not norm_key:
                continue

            clean_value = value
            if isinstance(value, str):
                clean_value = value.strip()
                if not clean_value:
                    clean_value = ''
                else:
                    try:
                        if '.' in clean_value:
                            clean_value = float(clean_value)
                        else:
                            clean_value = int(clean_value)
                    except (ValueError, TypeError):
                        pass
            elif value is None:
                clean_value = ''

            if clean_value != '':
                is_empty = False

            normalized_row[norm_key] = clean_value

        if not is_empty:
            normalized.append(normalized_row)
    return normalized

def extract_marks_from_document(file_path: str, file_type: str = None) -> dict:
    """
    Extracts marks data from a given document (PDF, CSV, Excel).

    Returns:
    {
        "metadata": { ... },   # PDF metadata (institute, subject, etc.) — empty for CSV/Excel
        "records":  [ ... ]    # normalized list of student data dicts
    }
    """
    if not file_type:
        _, ext = os.path.splitext(file_path)
        file_type = ext.lower().strip('.')

    if file_type == 'pdf':
        raw = process_multipage_pdf(file_path)
        metadata = {normalize_key(k): v for k, v in raw.get('metadata', {}).items()}
        records  = _normalize_records(raw.get('records', []))
    elif file_type in ['csv', 'xlsx', 'xls']:
        raw_records = process_spreadsheet(file_path)
        metadata = {}
        records  = _normalize_records(raw_records)
    else:
        raise ValueError(f"Unsupported file type: {file_type}")

    return {"metadata": metadata, "records": records}


def transform_to_db_friendly(raw_data: dict, mapping: dict) -> dict:
    """
    Transforms raw extracted records into a 'Database Friendly' format 
    using the provided AI-generated mapping.
    """
    routing = mapping.get("column_routing", {})
    sub_parts = mapping.get("sub_parts", [])
    
    marks_key = routing.get("marks_obtained_key")
    student_key = routing.get("student_identifier_key")
    
    transformed_records = []
    
    for record in raw_data.get("records", []):
        # 1. Extract Total Marks and handle Absent state
        raw_total = record.get(marks_key)
        is_absent = (raw_total == "AB" or raw_total == "" or raw_total is None)
        
        try:
            marks_obtained = 0.0 if is_absent else float(raw_total)
        except (ValueError, TypeError):
            marks_obtained = 0.0
            is_absent = True # Treat invalid non-numeric as absent/error
            
        # 2. Build sub_marks JSON object
        sub_marks = {}
        for part in sub_parts:
            r_key = part["raw_key"]
            m_name = part["meaningful_name"]
            val = record.get(r_key)
            
            # Normalize sub-mark value
            if val == "AB" or val == "" or val is None:
                sub_marks[m_name] = 0.0
            else:
                try:
                    sub_marks[m_name] = float(val)
                except:
                    sub_marks[m_name] = 0.0
                    
        # 3. Assemble the friendly record
        transformed_records.append({
            "university_roll_number": str(record.get(student_key, "")).strip(),
            "marks_obtained": marks_obtained,
            "is_absent": is_absent,
            "sub_marks": sub_marks
        })
        
    return {
        "metadata": {
            "canonical_components": [p["meaningful_name"] for p in sub_parts],
            "original_metadata": raw_data.get("metadata", {})
        },
        "records": transformed_records
    }
