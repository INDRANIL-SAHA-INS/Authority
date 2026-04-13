from __future__ import annotations

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_RIGHT, TA_CENTER
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, HRFlowable,
    Table, TableStyle, KeepTogether
)

from config import llm
from langchain_core.prompts import ChatPromptTemplate
from pydantic import BaseModel, Field
import json, os, time, tempfile, logging

logger = logging.getLogger(__name__)

PAGE_W, PAGE_H = A4
MARGIN_H = 14 * mm   # horizontal
MARGIN_V = 12 * mm   # top/bottom


# ─── Styles ───────────────────────────────────────────────────────────────────

DARK   = colors.HexColor("#1a1a2e")
GREY   = colors.HexColor("#555555")
LGREY  = colors.HexColor("#888888")

def _styles() -> dict:
    base = dict(fontName="Helvetica", fontSize=9, leading=12, textColor=colors.black)
    return {
        "name": ParagraphStyle("name",   fontName="Helvetica-Bold", fontSize=18, textColor=DARK, leading=22),
        "contact": ParagraphStyle("contact", fontName="Helvetica", fontSize=8,  textColor=GREY, leading=11),
        "section": ParagraphStyle("section", fontName="Helvetica-Bold", fontSize=9, textColor=DARK,
                                  leading=11, spaceBefore=6, spaceAfter=2, letterSpacing=0.8),
        "job_title": ParagraphStyle("job_title", fontName="Helvetica-Bold", fontSize=9,
                                    textColor=DARK, leading=11),
        "job_sub":   ParagraphStyle("job_sub",   fontName="Helvetica", fontSize=8, textColor=GREY, leading=10),
        "bullet":    ParagraphStyle("bullet",    fontName="Helvetica", fontSize=8.5, leading=11,
                                    leftIndent=8, firstLineIndent=0, bulletIndent=0),
        "body":      ParagraphStyle("body",      fontName="Helvetica", fontSize=8.5, leading=11.5),
        "skill":     ParagraphStyle("skill",     fontName="Helvetica", fontSize=8.5, leading=11),
        "small":     ParagraphStyle("small",     fontName="Helvetica", fontSize=8,   textColor=GREY, leading=10),
    }


# ─── Pydantic schema for LLM compact output ───────────────────────────────────

class TailoredExperience(BaseModel):
    company:  str
    title:    str
    location: str
    start:    str
    end:      str
    bullets: list[str] = Field(
        description="MAXIMUM 3 bullets. Each ≤18 words. Start with action verb. Include 1 metric."
    )

class TailoredCV(BaseModel):
    summary:        str       = Field(description="EXACTLY 2 sentences. Dense with job keywords. ≤40 words total.")
    skills_flat:    list[str] = Field(description="MAXIMUM 8 most job-relevant skills.")
    experience:     list[TailoredExperience] = Field(description="MAXIMUM 3 most relevant jobs. Quality over quantity.")
    keywords_added: list[str] = Field(description="Keywords from JD injected into this CV")


# ─── LLM Tailoring ───────────────────────────────────────────────────────────

TAILOR_PROMPT = ChatPromptTemplate.from_messages([
    ("system", """You are an expert CV writer. Tailor this CV for a STRICT SINGLE-PAGE output.

CRITICAL CONSTRAINTS (Failure to follow results in overflow):
- Summary: Exactly 2 sentences, ≤40 words total.
- Skills: Pick ONLY the top 8 most relevant skills.
- Experience: Select ONLY the 3 most recent/relevant jobs.
- Bullets: MAXIMUM 2 bullets per job. Each ≤18 words. Start with action verb.
- DO NOT invent information. Inject JD keywords naturally."""),
    ("human", """BASE CV:
{base_cv}

JOB: {job_title}
DESCRIPTION: {job_description}

Produce the compact, one-page tailored CV now."""),
])

def _tailor_with_llm(base_cv: dict, job_title: str, job_description: str) -> TailoredCV | None:
    structured_llm = llm.with_structured_output(TailoredCV, include_raw=True)
    try:
        result = structured_llm.invoke(
            TAILOR_PROMPT.format_messages(
                base_cv=json.dumps(base_cv, indent=2),
                job_title=job_title,
                job_description=job_description or "Not provided.",
            )
        )
        if result.get("parsing_error"):
            raise ValueError(result["parsing_error"])
        tc: TailoredCV = result["parsed"]
        logger.info(f"CV tailored. Keywords: {tc.keywords_added}")
        return tc
    except Exception as e:
        logger.warning(f"LLM tailoring failed: {e}. Using base CV.")
        return None


# ─── Platypus Story Builder ───────────────────────────────────────────────────

def _divider() -> HRFlowable:
    return HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#cccccc"), spaceAfter=3)

def _section_title(text: str, S: dict) -> list:
    return [
        Spacer(1, 4),
        Paragraph(text.upper(), S["section"]),
        HRFlowable(width="100%", thickness=0.8, color=DARK, spaceAfter=3),
    ]

def _str(val) -> str:
    """Safely convert any LLM output to a string for ReportLab Paragraphs."""
    if val is None: return ""
    if isinstance(val, dict):
        # Handle cases where LLM returns {"start":..., "end":...} instead of a string
        return " - ".join(str(v) for v in val.values() if v)
    return str(val)

def _build_story(cv: dict, summary: str, skills: list[str], experience: list[dict]) -> list:
    S = _styles()
    story = []

    # ── Header ────────────────────────────────────────────────────────────────
    story.append(Paragraph(_str(cv.get("name")), S["name"]))

    contact_parts = [p for p in [
        _str(cv.get("email")), _str(cv.get("phone")), _str(cv.get("location")),
        _str(cv.get("linkedin")), _str(cv.get("github")),
    ] if p]
    story.append(Paragraph("  |  ".join(contact_parts), S["contact"]))
    story.append(HRFlowable(width="100%", thickness=1.2, color=DARK, spaceBefore=4, spaceAfter=1))

    # ── Summary ───────────────────────────────────────────────────────────────
    story += _section_title("Professional Summary", S)
    story.append(Paragraph(_str(summary), S["body"]))

    # ── Skills ────────────────────────────────────────────────────────────────
    story += _section_title("Skills", S)
    # 2-column table for compact skills layout
    mid = (len(skills) + 1) // 2
    left_col  = [Paragraph(f"• {_str(s)}", S["skill"]) for s in skills[:mid]]
    right_col = [Paragraph(f"• {_str(s)}", S["skill"]) for s in skills[mid:]]
    # Pad shorter column
    while len(right_col) < len(left_col):
        right_col.append(Paragraph("", S["skill"]))
    skills_data = list(zip(left_col, right_col))
    skills_table = Table(skills_data, colWidths=[(PAGE_W - 2*MARGIN_H) / 2] * 2, hAlign="LEFT")
    skills_table.setStyle(TableStyle([
        ("VALIGN", (0,0), (-1,-1), "TOP"),
        ("TOPPADDING", (0,0), (-1,-1), 1),
        ("BOTTOMPADDING", (0,0), (-1,-1), 1),
        ("LEFTPADDING", (0,0), (-1,-1), 0),
        ("RIGHTPADDING", (0,0), (-1,-1), 4),
    ]))
    story.append(skills_table)

    # ── Experience ────────────────────────────────────────────────────────────
    story += _section_title("Work Experience", S)
    for job in experience:
        title   = _str(job.get('title'))
        company = _str(job.get('company'))
        start   = _str(job.get('start'))
        end     = _str(job.get('end'))
        
        left_text  = f"<b>{title} — {company}</b>"
        right_text = f"{start} – {end}" if start and end else (start or end or "")
        
        header_row = Table(
            [[Paragraph(left_text, S["job_title"]),
              Paragraph(right_text, S["job_sub"])]],
            colWidths=[PAGE_W - 2*MARGIN_H - 35*mm, 35*mm],
            hAlign="LEFT",
        )
        header_row.setStyle(TableStyle([
            ("VALIGN", (0,0), (-1,-1), "TOP"),
            ("ALIGN",  (1,0), (1,0),  "RIGHT"),
            ("LEFTPADDING",  (0,0), (-1,-1), 0),
            ("RIGHTPADDING", (0,0), (-1,-1), 0),
            ("TOPPADDING",   (0,0), (-1,-1), 0),
            ("BOTTOMPADDING",(0,0), (-1,-1), 0),
        ]))
        sub = Paragraph(_str(job.get("location")), S["small"])
        bullets = [Paragraph(f"• {_str(b)}", S["bullet"]) for b in job.get("bullets", [])]
        story.append(KeepTogether([header_row, sub, Spacer(1,2)] + bullets + [Spacer(1,4)]))

    # ── Education ─────────────────────────────────────────────────────────────
    story += _section_title("Education", S)
    for edu in cv.get("education", []):
        degree = _str(edu.get('degree'))
        field  = _str(edu.get('field'))
        inst   = _str(edu.get('institution'))
        
        left_text  = f"<b>{degree} {f'in {field}' if field else ''}</b> — {inst}"
        right_text = _str(edu.get("year"))
        
        edu_row = Table(
            [[Paragraph(left_text, S["job_title"]),
              Paragraph(right_text, S["job_sub"])]],
            colWidths=[PAGE_W - 2*MARGIN_H - 20*mm, 20*mm],
            hAlign="LEFT",
        )
        edu_row.setStyle(TableStyle([
            ("VALIGN", (0,0), (-1,-1), "TOP"),
            ("ALIGN",  (1,0), (1,0),  "RIGHT"),
            ("LEFTPADDING",  (0,0), (-1,-1), 0),
            ("RIGHTPADDING", (0,0), (-1,-1), 0),
            ("TOPPADDING",   (0,0), (-1,-1), 0),
            ("BOTTOMPADDING",(0,0), (-1,-1), 0),
        ]))
        gpa_line = []
        if edu.get("gpa"):
            gpa_line = [Paragraph(f"GPA: {edu['gpa']}", S["small"])]
        story.append(KeepTogether([edu_row, Spacer(1,2)] + gpa_line + [Spacer(1,4)]))

    # ── Projects ──────────────────────────────────────────────────────────────
    if cv.get("projects"):
        story += _section_title("Projects", S)
        for proj in cv["projects"]:
            tech = proj.get("tech", [])
            tech_list = tech if isinstance(tech, list) else [str(tech)]
            tech_line = f" <font color='#888888'>— {', '.join(tech_list)}</font>" if tech_list else ""
            
            header = Paragraph(f"<b>{_str(proj.get('name'))}</b>{tech_line}", S["job_title"])
            desc   = Paragraph(_str(proj.get("description")), S["body"])
            story.append(KeepTogether([header, desc, Spacer(1,4)]))

    # ── Certifications ────────────────────────────────────────────────────────
    if cv.get("certifications"):
        story += _section_title("Certifications", S)
        for cert in cv["certifications"]:
            story.append(Paragraph(f"• {_str(cert)}", S["body"]))

    return story


# ─── Public API ──────────────────────────────────────────────────────────────

def build_cv(base_cv: dict, job_title: str, job_description: str) -> str:
    """
    Tailor the base CV using an LLM for ATS optimisation, then render
    a compact, single-page PDF using ReportLab Platypus.
    Falls back to base CV data if LLM fails.
    Returns the absolute path to the generated PDF.
    """
    tailored = _tailor_with_llm(base_cv, job_title, job_description)

    if tailored:
        summary    = tailored.summary
        skills     = tailored.skills_flat
        experience = [e.model_dump() for e in tailored.experience]
    else:
        raw_skills = base_cv.get("skills", [])
        skills     = ([s for g in raw_skills.values() for s in g]
                      if isinstance(raw_skills, dict) else raw_skills)[:14]
        summary    = base_cv.get("summary", "")
        experience = base_cv.get("experience", [])

    out_path = os.path.join(tempfile.gettempdir(), f"cv_{int(time.time())}.pdf")

    doc = SimpleDocTemplate(
        out_path,
        pagesize=A4,
        leftMargin=MARGIN_H, rightMargin=MARGIN_H,
        topMargin=MARGIN_V,  bottomMargin=MARGIN_V,
        allowSplitting=1,    # Platypus handles splits cleanly
    )
    story = _build_story(base_cv, summary, skills, experience)
    doc.build(story)

    logger.info(f"CV written to: {out_path}")
    return out_path