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
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

import uuid
import time
import numpy as np
import tempfile
from src.core.face_detector import FaceDetector
from src.core.image_processor import load_image, validate_image, get_image_metadata
from src.core.postprocessing import filter_detections, assign_face_indices, calculate_face_area
from src.utils.visualize import draw_detections
from src.api.config import Settings
from src.api.validators import validate_enrollment_faces
from deepface import DeepFace
import os
from io import BytesIO
import cv2

settings = Settings()


def validate_uploaded_file(image: UploadFile, max_size_mb=15):
    allowed_ext = [".jpg", ".jpeg", ".png"]
    ext = image.filename.lower().split('.')[-1]
    if f".{ext}" not in allowed_ext:
        raise HTTPException(status_code=400, detail={
            "code": "INVALID_FILE_TYPE",
            "message": "Only JPG, JPEG, PNG files are allowed"
        })
    if image.size and image.size > max_size_mb * 1024 * 1024:
        raise HTTPException(status_code=400, detail={
            "code": "FILE_TOO_LARGE",
            "message": f"File size exceeds {max_size_mb}MB limit"
        })

def load_image_from_bytes(image_bytes):
    np_arr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(status_code=422, detail={
            "code": "CORRUPTED_IMAGE",
            "message": "Image file is corrupted or unreadable"
        })
    img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    return img

app = FastAPI()

# Serve static files (web interface)
app.mount("/static", StaticFiles(directory="src/api/static", html=True), name="static")

# Load model once at startup
try:
    detector = FaceDetector()
except Exception as e:
    detector = None
    model_error = str(e)
else:
    model_error = None



@app.post("/api/v1/visualize")
async def visualize_faces(image: UploadFile = File(...)):
    """
    Accept image, run detection, draw bounding boxes, return annotated image
    """
    validate_uploaded_file(image, max_size_mb=15)
    image_bytes = await image.read()
    img_array = load_image_from_bytes(image_bytes)
    if detector is None:
        raise HTTPException(status_code=503, detail={
            "code": "MODEL_NOT_LOADED",
            "message": model_error or "Model not loaded"
        })
    detections = detector.detect(img_array)
    detections = filter_detections(detections)
    detections = assign_face_indices(detections)
    annotated_image = draw_detections(img_array, detections)
    annotated_image_bgr = cv2.cvtColor(annotated_image, cv2.COLOR_RGB2BGR)
    _, buffer = cv2.imencode('.jpg', annotated_image_bgr)
    return StreamingResponse(
        BytesIO(buffer.tobytes()),
        media_type="image/jpeg",
        headers={"Content-Disposition": "inline; filename=annotated.jpg"}
    )

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

@app.post("/api/v1/detect")
def detect(image: UploadFile = File(...)):
    import base64
    allowed_ext = [".jpg", ".jpeg", ".png"]
    ext = image.filename.lower().split('.')[-1]
    print(f"[DEBUG] Uploaded file: {image.filename}, ext: {ext}")
    file_bytes = image.file.read()
    print(f"[DEBUG] File size: {len(file_bytes)} bytes")
    if f".{ext}" not in allowed_ext:
        print("[DEBUG] Invalid file extension")
        raise HTTPException(status_code=400, detail={
            "code": "INVALID_FILE_TYPE",
            "message": "Only JPG, JPEG, PNG files are allowed"
        })
    is_valid = validate_image(file_bytes)
    print(f"[DEBUG] validate_image result: {is_valid}")
    if not is_valid:
        print("[DEBUG] Image validation failed")
        raise HTTPException(status_code=422, detail={
            "code": "CORRUPTED_IMAGE",
            "message": "Image file is corrupted or unreadable"
        })
    if len(file_bytes) > 15 * 1024 * 1024:
        print("[DEBUG] File too large")
        raise HTTPException(status_code=400, detail={
            "code": "FILE_TOO_LARGE",
            "message": "File size exceeds 15MB limit"
        })
    try:
        with tempfile.NamedTemporaryFile(suffix=f".{ext}", delete=False) as tmp:
            tmp.write(file_bytes)
            temp_path = tmp.name
        image_np = load_image(temp_path)
    except Exception as e:
        print(f"[DEBUG] Exception in load_image: {e}")
        raise HTTPException(status_code=422, detail={
            "code": "CORRUPTED_IMAGE",
            "message": "Image file is corrupted or unreadable"
        })
    if detector is None:
        print("[DEBUG] Model not loaded")
        raise HTTPException(status_code=503, detail={
            "code": "MODEL_NOT_LOADED",
            "message": model_error or "Model not loaded"
        })
    start = time.time()
    try:
        detections = detector.detect(image_np)
    except Exception as e:
        print(f"[DEBUG] Exception in detector.detect: {e}")
        raise HTTPException(status_code=500, detail={
            "code": "DETECTION_FAILED",
            "message": "Face detection failed"
        })
    detections = filter_detections(detections, confidence_threshold=0.85, min_face_size=20, image_shape=image_np.shape[:2])
    detections = assign_face_indices(detections, sort_by='left_to_right')
    cropped_faces = []
    img_h, img_w = image_np.shape[0], image_np.shape[1]
    for det in detections:
        det['area_pixels'] = calculate_face_area(det['bbox'])
        bbox = det['bbox']
        x1, y1, x2, y2 = bbox['x1'], bbox['y1'], bbox['x2'], bbox['y2']
        # Add 20% padding to each side
        pad_x = int(0.2 * (x2 - x1))
        pad_y = int(0.2 * (y2 - y1))
        x1_pad = max(0, x1 - pad_x)
        y1_pad = max(0, y1 - pad_y)
        x2_pad = min(img_w, x2 + pad_x)
        y2_pad = min(img_h, y2 + pad_y)
        face_crop = image_np[y1_pad:y2_pad, x1_pad:x2_pad, :]
        # Encode cropped face as base64 JPEG
        if face_crop.size > 0:
            face_bgr = cv2.cvtColor(face_crop, cv2.COLOR_RGB2BGR)
            _, face_buf = cv2.imencode('.jpg', face_bgr)
            face_b64 = base64.b64encode(face_buf.tobytes()).decode('utf-8')
            cropped_faces.append(face_b64)
        else:
            cropped_faces.append(None)
    metadata = get_image_metadata(image_np)
    processing_time_ms = int((time.time() - start) * 1000)
    image_id = str(uuid.uuid4())
    print(f"[DEBUG] Detection complete: {len(detections)} faces, {processing_time_ms} ms")
    return {
        "success": True,
        "image_id": image_id,
        "metadata": {
            **metadata,
            "num_faces_detected": len(detections),
            "processing_time_ms": processing_time_ms
        },
        "faces": detections,
        "cropped_faces": cropped_faces
    }

@app.get("/api/v1/debug/{image_id}")
def debug_image(image_id: str):
    return JSONResponse(status_code=501, content={
        "success": False,
        "error": {
            "code": "NOT_IMPLEMENTED",
            "message": "Debug image endpoint not implemented yet"
        }
    })

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
async def extract_classroom_faces(image: UploadFile = File(...)):
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
    file_bytes = await image.read()
    ext = image.filename.lower().split('.')[-1]
    
    # 2. Decode Image for Cropping
    from src.core.image_processor import load_image
    import cv2
    import base64
    
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
