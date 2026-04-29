import os.path
import pickle
import base64
from email.message import EmailMessage
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from google.auth.transport.requests import Request
import requests

from typing import List, Optional
from mail_agent.schema import StudentRecord
# Scope for sending email
SCOPES = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.send'
]



# Get the directory where this script is located
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CREDENTIALS_PATH = os.path.join(os.path.dirname(BASE_DIR), 'credentials.json')
TOKEN_PATH = os.path.join(BASE_DIR, 'token.pickle')

def authenticate_gmail():
    creds = None

    if os.path.exists(TOKEN_PATH):
        with open(TOKEN_PATH, 'rb') as token:
            creds = pickle.load(token)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            if not os.path.exists(CREDENTIALS_PATH):
                raise FileNotFoundError(f"Missing Gmail credentials file at: {CREDENTIALS_PATH}")
                
            flow = InstalledAppFlow.from_client_secrets_file(
                CREDENTIALS_PATH, SCOPES)
            creds = flow.run_local_server(port=0)

        with open(TOKEN_PATH, 'wb') as token:
            pickle.dump(creds, token)

    return creds



def send_email(to_email, subject, body):
    creds = authenticate_gmail()
    service = build('gmail', 'v1', credentials=creds)

    message = EmailMessage()
    message.set_content(body)

    message['To'] = to_email
    message['From'] = "me"   # Gmail replaces this automatically
    message['Subject'] = subject

    # Encode message
    encoded_message = base64.urlsafe_b64encode(
        message.as_bytes()
    ).decode()

    create_message = {
        'raw': encoded_message
    }

    # Send email
    service.users().messages().send(
        userId='me',
        body=create_message
    ).execute()

    print("✅ Email sent successfully!")



def fetch_students_by_ids(subject_id: str, section_id: str, student_ids: List[str], attendance_threshold: float = 85.0) -> List[StudentRecord]:
    """Fetch specific students by their IDs from database via API"""
    print(f"[DB] Fetching students with IDs {student_ids} from section {section_id}")
    
    # API endpoint
    api_url = "http://localhost:3000/api/send_student_data_for_email"
    
    # Prepare the request body
    payload = {
        "section_id": section_id,
        "subject_id": subject_id,
        "student_ids": student_ids,
        "attendance_threshold": attendance_threshold
    }
    
    try:
        # Send POST request to API
        response = requests.post(api_url, json=payload)
        response.raise_for_status()  # Raise exception for bad status codes
        
        # Parse response
        api_response = response.json()
        print(f"[API] Response received: {api_response}")
        
        # Convert response data to StudentRecord objects
        students = []
        
        # Handle response structure with "data" array
        if isinstance(api_response, dict) and "data" in api_response:
            data_array = api_response["data"]
            for student_data in data_array:
                try:
                    # Extract attendance_details if present
                    attendance_details = student_data.get("attendance_details", {})
                    
                    # Map API response to StudentRecord fields
                    student_record = StudentRecord(
                        university_roll_number=student_data.get("university_roll_number", ""),
                        first_name=student_data.get("first_name", ""),
                        last_name=student_data.get("last_name", ""),
                        gender=student_data.get("gender", ""),
                        email=student_data.get("email", ""),
                        father_name=student_data.get("father_name", ""),
                        guardian_email=student_data.get("guardian_email", ""),
                        subject_id=attendance_details.get("subject_id", subject_id),
                        total_sessions=attendance_details.get("total_sessions", 0),
                        attended_sessions=attendance_details.get("attended_sessions", 0),
                        attendance_percentage=float(attendance_details.get("attendance_percentage", 0)),
                        is_short_attendance=attendance_details.get("is_short_attendance", False),
                        target_threshold=float(attendance_details.get("target_threshold", attendance_threshold))
                    )
                    students.append(student_record)
                except Exception as e:
                    print(f"[ERROR] Failed to parse student record: {e}")
                    continue
        
        # Handle direct list response
        elif isinstance(api_response, list):
            for student_data in api_response:
                try:
                    attendance_details = student_data.get("attendance_details", {})
                    student_record = StudentRecord(
                        university_roll_number=student_data.get("university_roll_number", ""),
                        first_name=student_data.get("first_name", ""),
                        last_name=student_data.get("last_name", ""),
                        gender=student_data.get("gender", ""),
                        email=student_data.get("email", ""),
                        father_name=student_data.get("father_name", ""),
                        guardian_email=student_data.get("guardian_email", ""),
                        subject_id=attendance_details.get("subject_id", subject_id),
                        total_sessions=attendance_details.get("total_sessions", 0),
                        attended_sessions=attendance_details.get("attended_sessions", 0),
                        attendance_percentage=float(attendance_details.get("attendance_percentage", 0)),
                        is_short_attendance=attendance_details.get("is_short_attendance", False),
                        target_threshold=float(attendance_details.get("target_threshold", attendance_threshold))
                    )
                    students.append(student_record)
                except Exception as e:
                    print(f"[ERROR] Failed to parse student record: {e}")
                    continue
        
        print(f"[DB] Found {len(students)} students from API")
        return students
        
    except requests.exceptions.RequestException as e:
        print(f"[ERROR] API request failed: {e}")
        return []




def fetch_students_below_attendance(subject_id: str, section_id: str, threshold: float) -> List[StudentRecord]:
    """Fetch all students in a section with attendance below threshold via API"""
    print(f"[DB] Fetching students below {threshold}% attendance from section {section_id}")
    
    # API endpoint
    api_url = "http://localhost:3000/api/send_student_data_for_email"
    
    # Prepare the request body with empty student_ids to fetch all below threshold
    payload = {
        "section_id": section_id,
        "subject_id": subject_id,
        "student_ids": [],  # Empty list means fetch all below threshold
        "attendance_threshold": threshold
    }
    
    try:
        # Send POST request to API
        response = requests.post(api_url, json=payload)
        response.raise_for_status()  # Raise exception for bad status codes
        
        # Parse response
        api_response = response.json()
        print(f"[API] Response received: {api_response}")
        
        # Convert response data to StudentRecord objects
        students = []
        
        # Handle response structure with "data" array
        if isinstance(api_response, dict) and "data" in api_response:
            data_array = api_response["data"]
            for student_data in data_array:
                try:
                    # Extract attendance_details if present
                    attendance_details = student_data.get("attendance_details", {})
                    
                    # Map API response to StudentRecord fields
                    student_record = StudentRecord(
                        university_roll_number=student_data.get("university_roll_number", ""),
                        first_name=student_data.get("first_name", ""),
                        last_name=student_data.get("last_name", ""),
                        gender=student_data.get("gender", ""),
                        email=student_data.get("email", ""),
                        father_name=student_data.get("father_name", ""),
                        guardian_email=student_data.get("guardian_email", ""),
                        subject_id=attendance_details.get("subject_id", subject_id),
                        total_sessions=attendance_details.get("total_sessions", 0),
                        attended_sessions=attendance_details.get("attended_sessions", 0),
                        attendance_percentage=float(attendance_details.get("attendance_percentage", 0)),
                        is_short_attendance=attendance_details.get("is_short_attendance", False),
                        target_threshold=float(attendance_details.get("target_threshold", threshold))
                    )
                    students.append(student_record)
                except Exception as e:
                    print(f"[ERROR] Failed to parse student record: {e}")
                    continue
        
        # Handle direct list response
        elif isinstance(api_response, list):
            for student_data in api_response:
                try:
                    attendance_details = student_data.get("attendance_details", {})
                    student_record = StudentRecord(
                        university_roll_number=student_data.get("university_roll_number", ""),
                        first_name=student_data.get("first_name", ""),
                        last_name=student_data.get("last_name", ""),
                        gender=student_data.get("gender", ""),
                        email=student_data.get("email", ""),
                        father_name=student_data.get("father_name", ""),
                        guardian_email=student_data.get("guardian_email", ""),
                        subject_id=attendance_details.get("subject_id", subject_id),
                        total_sessions=attendance_details.get("total_sessions", 0),
                        attended_sessions=attendance_details.get("attended_sessions", 0),
                        attendance_percentage=float(attendance_details.get("attendance_percentage", 0)),
                        is_short_attendance=attendance_details.get("is_short_attendance", False),
                        target_threshold=float(attendance_details.get("target_threshold", threshold))
                    )
                    students.append(student_record)
                except Exception as e:
                    print(f"[ERROR] Failed to parse student record: {e}")
                    continue
        
        print(f"[DB] Found {len(students)} students below {threshold}% attendance from API")
        return students
        
    except requests.exceptions.RequestException as e:
        print(f"[ERROR] API request failed: {e}")
        return []
