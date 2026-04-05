import os
import pickle
import base64
from email.message import EmailMessage
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from google.auth.transport.requests import Request
from langchain_community.chat_models import ChatOllama
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser
from models import StudentRecord

SCOPES = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.send'
]

# ─── LLM Setup for Emails ───────────────────────────────────────────────────

llm = ChatOllama(
    model="gemma3:4b",    
    temperature=1.3
)

EMAIL_GEN_PROMPT = """
You are an academic coordinator. Write a professional, polite, and firm email to a student's parent.

Student Name: {student_name}
Attendance: {attendance}%
Reason: {reason}
Marks Info: {marks}

Rules:
- Subject line should be relevant.
- Mention that this is an automated alert.
- Suggest a meeting or coordination with the class teacher.
- Keep it concise.

Output format:
Subject: [Your Subject Here]
Body: [Your Body Here]
"""

email_prompt = PromptTemplate.from_template(EMAIL_GEN_PROMPT)
email_chain = email_prompt | llm | StrOutputParser()


def authenticate_gmail():
    creds = None
    if os.path.exists('token.pickle'):
        with open('token.pickle', 'rb') as token:
            creds = pickle.load(token)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(
                'credentials.json', SCOPES)
            creds = flow.run_local_server(port=0)
        with open('token.pickle', 'wb') as token:
            pickle.dump(creds, token)

    return creds


def build_email_content_with_llm(student: StudentRecord, reason: str) -> tuple[str, str]:
    """
    Uses the local LLM to generate a professional email subject and body.
    Returns (subject, body).
    """
    print(f"🤖 Generating AI email content for {student.name}...")
    
    marks_str = ", ".join([f"{k}: {v}" for k, v in student.marks.items()]) if student.marks else "N/A"
    
    raw_output = email_chain.invoke({
        "student_name": student.name,
        "attendance": student.attendance_percentage,
        "reason": reason,
        "marks": marks_str
    })
    
    # Very simple parsing of "Subject:" and "Body:"
    subject = f"Notice: Academic Update for {student.name}"
    body = raw_output
    
    if "Subject:" in raw_output:
        parts = raw_output.split("Body:", 1)
        sub_part = parts[0].replace("Subject:", "").strip()
        if sub_part:
            subject = sub_part
        if len(parts) > 1:
            body = parts[1].strip()
            
    return subject, body


def send_email(to_email: str, subject: str, body: str) -> bool:
    """
    Sends an email via Gmail API.
    Returns True on success, False on failure.
    """
    try:
        creds = authenticate_gmail()
        service = build('gmail', 'v1', credentials=creds)

        message = EmailMessage()
        message.set_content(body)
        message['To'] = to_email
        message['From'] = "me"
        message['Subject'] = subject

        encoded_message = base64.urlsafe_b64encode(
            message.as_bytes()
        ).decode()

        service.users().messages().send(
            userId='me',
            body={'raw': encoded_message}
        ).execute()

        print(f"✅ Email sent to {to_email}")
        return True

    except Exception as e:
        print(f"❌ Failed to send email to {to_email}: {e}")
        return False


def dispatch_emails_for_student(
    student: StudentRecord,
    notify_scope: str,
    reason: str
) -> dict:
    """
    Sends email to parent, student, or both depending on notify_scope.
    Returns dict with sent/failed lists.
    """
    # Use AI to build the content
    try:
        subject, body = build_email_content_with_llm(student, reason or "attendance")
    except Exception as e:
        print(f"⚠️ AI generation failed, falling back to template. Error: {e}")
        subject = f"Academic Notice: {student.name}"
        body = f"Hello, this is a notice regarding {student.name}'s attendance ({student.attendance_percentage}%)."

    sent = []
    failed = []

    if notify_scope in ("parents_only", "both"):
        ok = send_email(student.parent_email, subject, body)
        (sent if ok else failed).append(student.parent_email)

    if notify_scope in ("student_only", "both") and student.student_email:
        ok = send_email(student.student_email, subject, body)
        (sent if ok else failed).append(student.student_email)

    return {"sent": sent, "failed": failed}
