"""
Implement validation functions:

def validate_uploaded_file(file: UploadFile, max_size_mb: int) -> None:
    # Check file extension
    # Check file size
    # Raise HTTPException if invalid
    pass

def validate_file_extension(filename: str, allowed: List[str]) -> bool:
    # Check if file has allowed extension
    pass
"""

from fastapi import UploadFile, HTTPException
from typing import List, Dict, Any
import os

def validate_enrollment_faces(results: List[Dict[str, Any]], confidence_threshold: float) -> None:
    """
    Validates DeepFace representation results based on Phase 1 Rules:
    1. Exactly 1 face must be detected.
    2. Confidence score must be > threshold.
    """
    if len(results) == 0:
        raise HTTPException(status_code=400, detail={
            "code": "NO_FACE_DETECTED",
            "message": "No face was detected. Please ensure the student is clearly visible."
        })
    if len(results) > 1:
        raise HTTPException(status_code=400, detail={
            "code": "MULTIPLE_FACES_DETECTED",
            "message": f"Found {len(results)} faces. Please ensure exactly 1 face is in the photo."
        })
        
    confidence = results[0].get("face_confidence", 1.0)
    if confidence < confidence_threshold:
        raise HTTPException(status_code=400, detail={
            "code": "LOW_CONFIDENCE",
            "message": f"Face is not clear enough (Confidence: {confidence:.2f}). Please retake with better lighting."
        })

def validate_uploaded_file(file: UploadFile, max_size_mb: int) -> None:
    ext = os.path.splitext(file.filename)[1].lower()
    allowed = ['.jpg', '.jpeg', '.png']
    if ext not in allowed:
        raise HTTPException(status_code=400, detail={
            "code": "INVALID_FILE_TYPE",
            "message": "Only JPG, JPEG, PNG files are allowed"
        })
    size = 0
    chunk = file.file.read(1024 * 1024)
    while chunk:
        size += len(chunk)
        if size > max_size_mb * 1024 * 1024:
            raise HTTPException(status_code=400, detail={
                "code": "FILE_TOO_LARGE",
                "message": f"File size exceeds {max_size_mb}MB limit"
            })
        chunk = file.file.read(1024 * 1024)
    file.file.seek(0)

def validate_file_extension(filename: str, allowed: List[str]) -> bool:
    ext = os.path.splitext(filename)[1].lower()
    return ext in [f'.{a.lower()}' for a in allowed]
