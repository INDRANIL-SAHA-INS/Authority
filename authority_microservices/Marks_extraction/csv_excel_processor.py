import pandas as pd

def process_spreadsheet(file_path: str) -> list:
    """
    Reads a CSV or Excel file and returns a list of dictionaries representing the rows.
    """
    if file_path.endswith('.csv'):
        df = pd.read_csv(file_path)
    elif file_path.endswith('.xlsx') or file_path.endswith('.xls'):
        df = pd.read_excel(file_path)
    else:
        raise ValueError("Unsupported spreadsheet format. Must be .csv, .xlsx, or .xls")
    
    # Handle NaN values and convert to dict
    df = df.fillna(0)
    
    return df.to_dict(orient='records')
