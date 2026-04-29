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
