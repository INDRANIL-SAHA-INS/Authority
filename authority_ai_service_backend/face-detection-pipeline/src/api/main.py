#uvicorn src.api.main:app --reload


"""
Create FastAPI app with the following endpoints:

POST /api/v1/detect
- Accept multipart/form-data with 'image' field
- Validate file type and size
- Run face detection
- Return JSON response

GET /api/v1/health
- Return service status and model info

GET /api/v1/debug/{image_id}
- Return debug image with drawn bounding boxes (optional)
"""

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse

import time
import tempfile
import base64
from src.core.face_detector import FaceDetector
from src.core.image_processor import load_image, validate_image, get_image_metadata
from pydantic import BaseModel
from src.api.config import Settings
from src.api.validators import validate_enrollment_faces, validate_uploaded_file
from deepface import DeepFace
import os
from io import BytesIO
import cv2

class AgentResponse(BaseModel):
    success: bool
    status: str
    message: str
    data: dict

settings = Settings()


app = FastAPI()

# Load model once at startup
try:
    detector = FaceDetector()
except Exception as e:
    detector = None
    model_error = str(e)
else:
    model_error = None


@app.get("/api/v1/health")
def health():
    if detector is None:
        return JSONResponse(status_code=503, content={
            "success": False,
            "error": {
                "code": "MODEL_NOT_LOADED",
                "message": model_error or "Model not loaded"
            }
        })
    return {
        "success": True,
        "model": detector.model_name,
        "device": detector.device,
        "confidence_threshold": detector.confidence_threshold
    }

@app.post("/api/v1/enroll")
def enroll_student(image: UploadFile = File(...)):
    """
    Phase 1: Student Registration (Enrollment)
    Accepts 1 image of a student, uses DeepFace to validate the face count and confidence,
    and returns a 512-dimensional vector (ArcFace) for storage in the database.
    """
    print("\n[API START] ---> ENROLL_STUDENT ---------------------")
    print(f"      [Step] Uploaded Enrollment Image: {image.filename}")
    # 1. Base API Validation
    validate_uploaded_file(image, max_size_mb=settings.max_file_size_mb)
    
    file_bytes = image.file.read()
    ext = image.filename.lower().split('.')[-1]
    
    # Write to a temporary file because DeepFace prefers file paths
    with tempfile.NamedTemporaryFile(suffix=f".{ext}", delete=False) as tmp:
        tmp.write(file_bytes)
        temp_path = tmp.name
        
    try:
        # 2. Run DeepFace (Det & Recog in one line)
        # enforce_detection=False so we can handle 0 faces gracefully in our validator
        results = DeepFace.represent(
            img_path=temp_path,
            model_name=settings.recognition_model,
            detector_backend=settings.detection_model,
            enforce_detection=False
        )
        
        # NOTE: If enforce_detection=False and NO face is found, DeepFace will sometimes 
        # return a representation of the entire image with a face_confidence of 0.
        # We handle this inside validate_enrollment_faces.
        
        # Filter out objects returned if their confidence is 0 (which means no actual face was detected)
        valid_faces = [face for face in results if face.get("face_confidence", 0) > 0]
        
    except Exception as e:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        raise HTTPException(status_code=500, detail={
            "code": "AI_PROCESSING_ERROR",
            "message": str(e)
        })
        
    # Cleanup Temp File
    if os.path.exists(temp_path):
        os.remove(temp_path)
        
    # 3. Apply Mandatory AI Validation Rules (Phase 1)
    validate_enrollment_faces(valid_faces, confidence_threshold=settings.registration_confidence_threshold)
    
    # 4. Success Response
    face_data = valid_faces[0]
    embedding = face_data["embedding"]
    confidence = face_data.get("face_confidence", 1.0)
    facial_area = face_data.get("facial_area", {})
    
    return {
        "success": True,
        "message": "Face processed successfully for enrollment",
        "model_used": settings.recognition_model,
        "detector_used": settings.detection_model,
        "vector": embedding,
        "dimensions": len(embedding),
        "confidence": confidence,
        "facial_area": facial_area
    }


@app.post("/api/attendance/process_classroom")
def extract_classroom_faces(image: UploadFile = File(...)):
    """
    Phase 2: Bulk Face Extraction (Attendance Core)
    Accepts a high-resolution classroom image, finds EVERY face, 
    generates 512-d ArcFace vectors, and returns crops for auditing.
    """
    print("\n[API START] ---> EXTRACT_CLASSROOM_FACES ------------")
    print(f"      [Step] Uploaded Classroom Image: {image.filename}")
    # 1. Image Validation
    validate_uploaded_file(image, max_size_mb=25) # Slightly higher limit for classroom photos
    
    start_time = time.time()
    file_bytes = image.file.read()
    ext = image.filename.lower().split('.')[-1]
    
    # 2. Decode Image for Cropping
    with tempfile.NamedTemporaryFile(suffix=f".{ext}", delete=False) as tmp:
        tmp.write(file_bytes)
        temp_path = tmp.name
        
    try:
        # Load the full image for high-quality crops
        image_np = cv2.imread(temp_path)
        if image_np is None:
            raise HTTPException(status_code=422, detail="Unable to decode image")
        image_h, image_w = image_np.shape[:2]
        
        # 3. DeepFace Bulk Representation
        # RetinaFace is essential here for crowd accuracy
        try:
            detections = DeepFace.represent(
                img_path=temp_path,
                model_name=settings.recognition_model,
                detector_backend=settings.detection_model,
                enforce_detection=True, # We want to ignore non-face noise
                align=True
            )
        except Exception as e:
            # If no face is detected, DeepFace raises a ValueError or standard Exception
            if "Face could not be detected" in str(e):
                print(f"[AI ENGINE] No faces detected in classroom photo: {temp_path}")
                return {
                    "success": True,
                    "faces_found": 0,
                    "processing_time_ms": (time.time() - start_time) * 1000,
                    "detections": []
                }
            # Re-raise if it's some other problem
            raise e
        
        results = []
        
        # 4. Process Each Detected Face
        for idx, face in enumerate(detections):
            # Extract Vector
            vector = face.get("embedding", [])
            area = face.get("facial_area", {})
            confidence = face.get("face_confidence", 0)
            
            # Skip very low confidence detections in the crowd
            if confidence < 0.40: # RetinaFace is robust, but crowd shadows can be tricky
                continue
                
            # Perform High-Quality Crop with 15% Padding
            x, y, w, h = area['x'], area['y'], area['w'], area['h']
            pad_w = int(w * 0.15)
            pad_h = int(h * 0.15)
            
            x1 = max(0, x - pad_w)
            y1 = max(0, y - pad_h)
            x2 = min(image_w, x + w + pad_w)
            y2 = min(image_h, y + h + pad_h)
            
            face_crop = image_np[y1:y2, x1:x2]
            
            # Encode Crop to Base64
            face_b64 = ""
            if face_crop.size > 0:
                _, buffer = cv2.imencode('.jpg', face_crop, [int(cv2.IMWRITE_JPEG_QUALITY), 90])
                face_b64 = base64.b64encode(buffer).decode('utf-8')

            results.append({
                "face_index": idx,
                "vector": vector,
                "confidence": confidence,
                "facial_area": area,
                "crop_b64": face_b64
            })
            
        processing_time = (time.time() - start_time) * 1000
        print(f"[AI ENGINE] Processed classroom photo: {len(results)} faces found in {processing_time:.2f}ms")
        
        return {
            "success": True,
            "faces_found": len(results),
            "processing_time_ms": processing_time,
            "detections": results
        }

    except Exception as e:
        print(f"[AI ENGINE] Fatal Error in Classroom Processing: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)
