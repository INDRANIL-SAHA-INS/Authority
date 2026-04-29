import pdfplumber


def _find_header_anchor_idx(cleaned: list) -> int | None:
    """
    Finds the index of the first real table-header row using structural heuristics only.
    No hardcoded column-name keywords are used.

    A real table header row:
      1. Has HIGH cell density (>= 30% of the widest row filled)
      2. Does NOT look like a data row (no pure ints, no USN-like codes)
      3. Is followed by at least one data row within the next 4 rows
    
    Metadata rows (institute name, year, subject…) are "sparse" — they have
    only 1-2 filled cells across many columns, so they are skipped naturally.
    """
    if not cleaned:
        return None

    max_cols = max(len(row) for row in cleaned)
    # Require at least 30% of columns to be filled (min 2)
    density_threshold = max(2, int(max_cols * 0.30))

    for i, row in enumerate(cleaned):
        non_empty = sum(1 for c in row if c and c.strip())

        # Skip sparse rows (metadata)
        if non_empty < density_threshold:
            continue

        # Skip rows that already look like data
        if _is_data_row(row):
            continue

        # Confirm it's followed by at least one data row
        for j in range(i + 1, min(i + 5, len(cleaned))):
            if _is_data_row(cleaned[j]):
                return i  # this is the header

    return None


def _is_header_row(row: list, flat_headers: list) -> bool:
    """
    On subsequent pages, detect a repeated header row structurally:
    it must be non-data AND have high density matching the header column count.
    """
    if _is_data_row(row):
        return False
    non_empty = sum(1 for c in row if c and c.strip())
    return non_empty >= max(2, int(len(flat_headers) * 0.30))


def _is_data_row(row: list) -> bool:
    """
    Returns True if this row is a student data row.
    Heuristic: has a pure integer in any cell OR has a USN-like code.
    """
    for cell in row:
        c = str(cell).strip() if cell else ''
        if not c:
            continue
        # Pure integer (serial number or mark)
        try:
            int(c)
            return True
        except ValueError:
            pass
        # USN pattern: starts with digit, contains letters (e.g. 1RUA24BCA0001)
        if len(c) > 5 and c[0].isdigit() and any(ch.isalpha() for ch in c):
            return True
    return False


def _clean_cell(cell) -> str:
    """Clean a single cell value."""
    if cell is None:
        return ''
    return str(cell).replace('\n', ' ').strip()


def _forward_fill(row: list) -> list:
    """Forward-fill empty cells (from PDF merged/spanned cells)."""
    filled = []
    last = ''
    for cell in row:
        if cell:
            last = cell
            filled.append(cell)
        else:
            filled.append(last)
    return filled


def _flatten_headers(header_rows: list) -> list:
    """
    Flatten multiple header rows into a single list of column labels.
    Uses forward-fill for merged cells, then combines labels per column
    deduplicating repeated group prefixes.
    e.g. ["CIE-I", "CIE-I QUIZ Max Marks"] → "CIE-I QUIZ Max Marks"
         ["SL.NO", "SL.NO"] → "SL.NO"
    """
    num_cols = max(len(r) for r in header_rows)

    # Pad all header rows to the same column count
    padded = []
    for hr in header_rows:
        row = list(hr) + [''] * (num_cols - len(hr))
        padded.append(row)

    if len(padded) == 1:
        return padded[0]

    # Forward-fill merged cells row by row
    ffilled = [_forward_fill(r) for r in padded]

    flat = []
    for col_idx in range(num_cols):
        parts = []
        seen = set()
        for hr in ffilled:
            val = hr[col_idx].strip()
            if val and val not in seen:
                parts.append(val)
                seen.add(val)
        flat.append(' '.join(parts))
    return flat


def _align_row(row: list, num_cols: int) -> list:
    """Pad or truncate a row to exactly num_cols entries."""
    if len(row) < num_cols:
        return row + [''] * (num_cols - len(row))
    return row[:num_cols]


def _extract_metadata(sparse_rows: list) -> dict:
    """
    Converts sparse metadata rows into a clean key-value dict.

    Each sparse row typically looks like:
      ['INSTITUTE NAME : RV UNIVERSITY', '', '', ...]
      ['SUBJECT : AGILE SOFTWARE ENGINEERING', '', ...]

    Strategy:
    - Take the first non-empty cell from each row.
    - If it contains ':', split on the FIRST ':' to get key + value.
    - Otherwise, use the full text as a plain note.
    """
    metadata: dict = {}
    for row in sparse_rows:
        # Get the first non-empty cell only
        text = next((c for c in row if c and c.strip()), None)
        if not text:
            continue

        if ':' in text:
            raw_key, _, raw_val = text.partition(':')
            key = raw_key.strip().lower().replace(' ', '_')
            val = raw_val.strip()
        else:
            # No colon — store it as a generic label
            key = text.strip().lower().replace(' ', '_')[:40]
            val = text.strip()

        if key:
            metadata[key] = val

    return metadata


def process_multipage_pdf(file_path: str) -> dict:
    """
    Extracts tabular data from multipage PDFs using pdfplumber.

    Returns a dict:
    {
        "metadata": { ... },   # sparse rows above the table (institute, subject, etc.)
        "records": [ ... ]     # list of student data dicts
    }
    """
    records: list = []
    metadata: dict = {}
    flat_headers: list | None = None
    num_cols: int = 0
    metadata_collected: bool = False

    with pdfplumber.open(file_path) as pdf:
        for page in pdf.pages:
            tables = page.extract_tables()
            for table in tables:
                if not table:
                    continue

                # ── Clean every row ────────────────────────────────────────────────────
                cleaned: list[list[str]] = []
                for row in table:
                    if any(cell and str(cell).strip() for cell in row):
                        cleaned.append([_clean_cell(c) for c in row])

                if not cleaned:
                    continue

                if flat_headers is None:
                    # ── Find the anchor row (first real header row) ────────────
                    anchor_idx = _find_header_anchor_idx(cleaned)

                    if anchor_idx is None:
                        # No dense header-like row found — treat whole table as metadata
                        if not metadata_collected:
                            max_cols = max(len(r) for r in cleaned)
                            sparse = [r for r in cleaned
                                      if sum(1 for c in r if c) < max(2, int(max_cols * 0.30))]
                            metadata.update(_extract_metadata(sparse))
                        continue

                    # ── Rows before the anchor = metadata ──────────────────────
                    if not metadata_collected and anchor_idx > 0:
                        sparse_rows = cleaned[:anchor_idx]
                        metadata.update(_extract_metadata(sparse_rows))
                        metadata_collected = True

                    # ── Collect all header rows (anchor + following non-data rows)
                    header_rows: list[list[str]] = [cleaned[anchor_idx]]
                    data_start_idx = anchor_idx + 1

                    for j in range(anchor_idx + 1, len(cleaned)):
                        if _is_data_row(cleaned[j]):
                            data_start_idx = j
                            break
                        header_rows.append(cleaned[j])
                    else:
                        data_start_idx = len(cleaned)  # no data rows on this page

                    # ── Flatten multi-level headers ────────────────────────────
                    flat_headers = _flatten_headers(header_rows)
                    num_cols = len(flat_headers)

                    # ── Map data rows ───────────────────────────────────────────────
                    for row in cleaned[data_start_idx:]:
                        aligned = _align_row(row, num_cols)
                        records.append(dict(zip(flat_headers, aligned)))

                else:
                    # ── Subsequent pages: skip repeated header rows, keep data ──
                    for row in cleaned:
                        if _is_header_row(row, flat_headers):
                            continue
                        if not _is_data_row(row):
                            continue
                        aligned = _align_row(row, num_cols)
                        records.append(dict(zip(flat_headers, aligned)))

    return {"metadata": metadata, "records": records}
