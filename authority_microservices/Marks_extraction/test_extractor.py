import sys
import json
import os

# Ensure the parent directory is in sys.path so Python treats this folder as a package
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from Marks_extraction.extractor_service import extract_marks_from_document

def main():
    print("=== Marks Extractor Test CLI ===")
    
    if len(sys.argv) > 1:
        file_path = sys.argv[1]
    else:
        import tkinter as tk
        from tkinter import filedialog
        
        # Initialize Tkinter and hide the main window
        root = tk.Tk()
        root.attributes('-topmost', True) # Bring to the front
        root.withdraw()
        
        print("Opening file dialog... Please select a document.")
        file_path = filedialog.askopenfilename(
            title="Select a Document (PDF, CSV, XLSX)",
            filetypes=[("Documents", "*.pdf *.csv *.xlsx *.xls"), ("All Files", "*.*")]
        )
        
        if not file_path:
            print("No file selected. Exiting.")
            sys.exit(0)

    # Remove quotes if pasted with them
    file_path = file_path.strip('"').strip("'")

    if not os.path.exists(file_path):
        print(f"Error: File not found at '{file_path}'")
        sys.exit(1)

    print(f"\nProcessing file: {file_path}")
    
    try:
        result = extract_marks_from_document(file_path)

        metadata = result.get("metadata", {})
        records  = result.get("records", [])

        # Print metadata section
        print("\n--- Document Metadata ---")
        if metadata:
            print(json.dumps(metadata, indent=2))
        else:
            print("(No metadata found)")

        # Print records section
        print(f"\n--- Extracted Records ({len(records)} rows) ---")
        print(json.dumps(records, indent=2))

        # Save the full structured output to test_output.json
        script_dir = os.path.dirname(os.path.abspath(__file__))
        out_path = os.path.join(script_dir, 'test_output.json')
        with open(out_path, 'w') as f:
            json.dump(result, f, indent=2)
        print(f"\nSaved full output to {out_path}")

    except Exception as e:
        import traceback
        print(f"\nAn error occurred during extraction:")
        traceback.print_exc()


if __name__ == "__main__":
    main()
