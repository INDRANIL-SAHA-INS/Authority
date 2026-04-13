job_agent/
├── main.py                  # Entry point
├── config.py                # Config, model setup (Ollama)
├── state.py                 # LangGraph state model
├── graph.py                 # LangGraph graph definition & edges
├── nodes/
│   ├── __init__.py
│   ├── parse_input.py       # Parse URL + prompt intent
│   ├── fetch_job.py         # Playwright: fetch job page, find apply link
│   ├── extract_fields.py    # Extract form fields from apply page
│   ├── prepare_cv.py        # Generate tailored CV from base CV
│   ├── fill_form.py         # Playwright: fill and submit form
│   └── notify.py            # Notify user of result
├── tools/
│   ├── cv_builder.py        # CV generation using reportlab/weasyprint
│   └── browser.py           # Playwright browser utility
├── assets/
│   └── base_cv.json         # User's base CV data
└── requirements.txt