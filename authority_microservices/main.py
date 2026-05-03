"""
Authority Microservices — Root API
===================================
Unified FastAPI gateway exposing:
  • /api/marks/extract   → Marks Extraction service  (PDF / CSV / Excel)
  • /api/mail/send-agent → Mail Agent service          (LangGraph + Gmail)

Run:
    uvicorn main:app --reload --port 8001
"""

import os
import shutil
import tempfile
import traceback
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile, status, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# ── Service imports ────────────────────────────────────────────────────────────
from Marks_extraction import extract_marks_from_document
from mail_agent.graph import graph as mail_graph
from mail_agent.schema import SubjectContext
from langchain_core.messages import HumanMessage, AIMessage


# ══════════════════════════════════════════════════════════════════════════════
# App bootstrap
# ══════════════════════════════════════════════════════════════════════════════

app = FastAPI(
    title="Authority Microservices API",
    description=(
        "Unified gateway for the Authority platform microservices.\n\n"
        "**Services:**\n"
        "- **Marks Extraction** — Upload a PDF / CSV / Excel file and get structured student marks JSON.\n"
        "- **Mail Agent** — Send attendance / marks alert emails via a natural-language LangGraph agent."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ══════════════════════════════════════════════════════════════════════════════
# Shared response envelope
# ══════════════════════════════════════════════════════════════════════════════

class SuccessResponse(BaseModel):
    success: bool = True
    data: Any


class ErrorResponse(BaseModel):
    success: bool = False
    error: str
    detail: Optional[str] = None


# ══════════════════════════════════════════════════════════════════════════════
# ── 1. MARKS EXTRACTION SERVICE ───────────────────────────────────────────────
# ══════════════════════════════════════════════════════════════════════════════

# ── Response models ────────────────────────────────────────────────────────────

class MarksMetadata(BaseModel):
    """Sparse metadata pulled from the document (e.g. subject, faculty name)."""
    model_config = {"extra": "allow"}


class MarksExtractionResponse(BaseModel):
    success: bool = True
    filename: str
    file_type: str
    metadata: Dict[str, Any]
    total_records: int
    records: List[Dict[str, Any]]


# ── Route ─────────────────────────────────────────────────────────────────────

ALLOWED_MARKS_EXTENSIONS = {".pdf", ".csv", ".xlsx", ".xls"}


@app.post(
    "/api/marks/extract",
    response_model=MarksExtractionResponse,
    summary="Extract student marks from an uploaded document",
    tags=["Marks Extraction"],
    responses={
        200: {"description": "Marks extracted successfully."},
        400: {"model": ErrorResponse, "description": "Unsupported file type or bad upload."},
        422: {"model": ErrorResponse, "description": "Extraction failed due to malformed document."},
        500: {"model": ErrorResponse, "description": "Internal server error."},
    },
)
async def extract_marks(
    file: UploadFile = File(
        ...,
        description=(
            "Document to extract marks from. "
            "Supported formats: **PDF** (multi-page, multi-header), "
            "**CSV**, **XLSX**, **XLS**."
        ),
    ),
):
    """
    ### Extract student marks

    Upload a document and receive structured JSON with:
    - **metadata** — subject, faculty name, institute (from PDF headers)
    - **records**  — one dict per student row with normalized snake_case keys
                     and numeric values cast to `int` / `float` automatically

    #### Supported file types
    | Format | Notes |
    |--------|-------|
    | PDF    | Multi-page, merged-cell headers supported |
    | CSV    | First row must be the header |
    | XLSX / XLS | First sheet, first row must be the header |
    """
    # ── Validate extension ─────────────────────────────────────────────────────
    original_filename = file.filename or "upload"
    _, ext = os.path.splitext(original_filename)
    ext = ext.lower()

    if ext not in ALLOWED_MARKS_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Unsupported file type '{ext}'. "
                f"Allowed: {', '.join(ALLOWED_MARKS_EXTENSIONS)}"
            ),
        )

    # ── Save upload to a temp file (service needs a real path) ────────────────
    tmp_path: Optional[str] = None
    try:
        with tempfile.NamedTemporaryFile(
            delete=False, suffix=ext, mode="wb"
        ) as tmp:
            shutil.copyfileobj(file.file, tmp)
            tmp_path = tmp.name

        # ── Call the service ───────────────────────────────────────────────────
        result = extract_marks_from_document(
            file_path=tmp_path,
            file_type=ext.lstrip("."),
        )

        return MarksExtractionResponse(
            filename=original_filename,
            file_type=ext.lstrip("."),
            metadata=result.get("metadata", {}),
            total_records=len(result.get("records", [])),
            records=result.get("records", []),
        )

    except ValueError as ve:
        # e.g. unsupported file type raised inside the service
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(ve),
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Extraction failed: {exc}",
        )
    finally:
        # Always clean up the temp file
        if tmp_path and os.path.exists(tmp_path):
            os.remove(tmp_path)




class MailAgentRequest(BaseModel):
    """
    Natural-language query that the Mail Agent will parse and act on.

    The agent uses an LLM (Gemma 3:4b via Ollama) to extract intent, then:
    1. Resolves the target students from the Authority backend API
    2. Generates personalised email bodies via the LLM
    3. Sends emails via Gmail OAuth
    """
    message: str = Field(
        ...,
        min_length=1,
        description="Current natural-language instruction from the teacher.",
    )
    context: List[SubjectContext] = Field(
        default_factory=list,
        description="Available subject/section mapping for the current teacher."
    )


class MailAgentResponse(BaseModel):
    success: bool
    status: str
    query: str
    emails_sent: List[str] = []
    emails_failed: List[str] = []
    email_errors: List[str] = []
    error: Optional[str] = None


# ── Route ─────────────────────────────────────────────────────────────────────

@app.post(
    "/api/mail/ai-dispatch",
    response_model=MailAgentResponse,
    summary="Run the Mail Agent with a natural-language query",
    tags=["Mail Agent"],
    responses={
        200: {"description": "Agent ran successfully (check `status` for details)."},
        400: {"model": ErrorResponse, "description": "Query is too short or empty."},
        502: {"model": ErrorResponse, "description": "LLM or Gmail backend error."},
        500: {"model": ErrorResponse, "description": "Internal server error."},
    },
)
async def run_mail_agent(body: MailAgentRequest, background_tasks: BackgroundTasks):
    """
    ### Run the Mail Agent

    Accepts a structured payload with **message** and **context**.
    Processing happens in the background to prevent timeouts.
    """
    try:
        # Create the message list (history removed as requested)
        messages = [HumanMessage(content=body.message)]

        # We run the graph immediately. 
        # Note: If the email sending logic inside the graph is slow, 
        # you might want to move the entire graph.invoke to background_tasks.
        # But for now, we'll keep it here so we can return the 'status'.
        
        output = mail_graph.invoke({
            "messages": messages,
            "context": body.context
        })

        agent_status: str = output.get("status", "unknown")
        emails_sent: List[str] = output.get("emails_sent", [])
        emails_failed: List[str] = output.get("emails_failed", [])
        email_errors: List[str] = output.get("email_errors", [])
        agent_error: Optional[str] = output.get("error")

        if agent_status == "failed":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=agent_error or "Agent could not process the request.",
            )

        return MailAgentResponse(
            success=agent_status not in ("all_emails_failed", "failed"),
            status=agent_status,
            query=body.message,
            emails_sent=emails_sent,
            emails_failed=emails_failed,
            email_errors=email_errors,
            error=agent_error,
        )

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Mail agent failed: {str(exc)}",
        )


# ══════════════════════════════════════════════════════════════════════════════
# Health check
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/health", tags=["System"], summary="Health check")
async def health():
    """Returns 200 OK when the service is running."""
    return {"status": "ok", "service": "authority-microservices"}


# ══════════════════════════════════════════════════════════════════════════════
# Dev runner
# ══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)
