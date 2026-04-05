# FACE DETECTION PIPELINE - IMPLEMENTATION TASK
# python -m uvicorn src.api.main:app --reload
## PROJECT OVERVIEW

Build a robust face detection API that can detect 1-70+ faces in a single image, return bounding boxes and landmarks for each face, and handle real-world classroom/group photos reliably.

---

## SETUP INSTRUCTIONS

### 1. Environment Setup

```bash
# Create project directory
mkdir face-detection-pipeline
cd face-detection-pipeline

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Create project structure
mkdir -p src/api src/api/static src/core src/utils tests data/uploads data/outputs
touch src/__init__.py src/api/__init__.py src/core/__init__.py src/utils/__init__.py
```

### 2. Install Dependencies

Create `requirements.txt`:

```txt
# Core ML libraries
opencv-python==4.8.1.78
opencv-contrib-python==4.8.1.78
numpy==1.24.3
Pillow==10.1.0

# Face detection models (choose one)
retinaface-pytorch==0.0.3  # Recommended - best accuracy
# OR
facenet-pytorch==2.5.3  # Alternative - includes MTCNN
# OR  
mediapipe==0.10.8  # Alternative - fastest but less accurate

# API framework
fastapi==0.104.1
uvicorn[standard]==0.24.0
python-multipart==0.0.6

# Utilities
python-dotenv==1.0.0
pydantic==2.5.0

# Testing
pytest==7.4.3
pytest-asyncio==0.21.1
httpx==0.25.1
```

Install:
```bash
pip install -r requirements.txt
```

### 3. Download Model Weights (if using RetinaFace)

```bash
# Create models directory
mkdir -p models

# RetinaFace will auto-download weights on first use
# OR manually download from: 
# https://github.com/biubug6/Pytorch_Retinaface
```

### 4. Environment Variables

Create `.env` file:

```env
# API Configuration
API_HOST=0.0.0.0
API_PORT=8000
MAX_FILE_SIZE_MB=15
ALLOWED_EXTENSIONS=jpg,jpeg,png

# Detection Configuration
DETECTION_MODEL=retinaface  # Options: retinaface, mtcnn, mediapipe
CONFIDENCE_THRESHOLD=0.85
MIN_FACE_SIZE=20
DEVICE=cpu  # Options: cpu, cuda

# Logging
LOG_LEVEL=INFO
```

### 5. Verify Setup

Create `verify_setup.py`:

```python
import cv2
import numpy as np
from PIL import Image

print("OpenCV version:", cv2.__version__)
print("NumPy version:", np.__version__)
print("PIL version:", Image.__version__)

# Test basic image operations
test_img = np.zeros((100, 100, 3), dtype=np.uint8)
print("✓ NumPy array creation works")

# Test OpenCV
gray = cv2.cvtColor(test_img, cv2.COLOR_RGB2GRAY)
print("✓ OpenCV operations work")

print("\n✓ Setup complete!")
```

Run: `python verify_setup.py`

---

## IMPLEMENTATION TASKS

### PHASE 1: Core Detection Engine

#### Task 1.1: Face Detector Class
**File**: `src/core/face_detector.py`

```python
"""
Implement FaceDetector class with the following signature:

class FaceDetector:
    def __init__(self, model_name='retinaface', device='cpu', confidence_threshold=0.85):
        # Load model once
        # Set device (CPU/GPU)
        # Store threshold
        pass
    
    def detect(self, image: np.ndarray) -> List[Dict]:
        # Run detection on image
        # Return list of detections
        pass
"""
```

**Requirements**:
- Load model in `__init__` (NOT in detect method)
- Accept RGB numpy array (H, W, 3) as input
- Return list of dicts with keys:
  - `bbox`: `{"x1": int, "y1": int, "x2": int, "y2": int}`
  - `landmarks`: `{"left_eye": [x, y], "right_eye": [x, y], "nose": [x, y], "mouth_left": [x, y], "mouth_right": [x, y]}`
  - `confidence`: float (0.0 to 1.0)
- Handle GPU/CPU device switching
- Raise clear exceptions on model loading failures

**Test criteria**:
- Detects faces in test image with confidence > 0.85
- Returns empty list for image with no faces
- Processes 4K image in <500ms

---

#### Task 1.2: Image Loading & Preprocessing
**File**: `src/core/image_processor.py`

```python
"""
Implement the following functions:

def load_image(file_path: str) -> np.ndarray:
    # Load image from file path
    # Handle EXIF rotation
    # Convert to RGB
    # Return numpy array
    pass

def validate_image(file_bytes: bytes, max_size_mb: int = 15) -> bool:
    # Check file size
    # Verify it's a valid image
    # Return True/False
    pass

def get_image_metadata(image: np.ndarray) -> Dict:
    # Extract height, width, channels
    # Calculate aspect ratio
    # Return metadata dict
    pass
"""
```

**Requirements**:
- Use OpenCV for loading (faster than PIL)
- Handle EXIF orientation tags (use PIL.ImageOps.exif_transpose)
- Convert BGR to RGB automatically
- Support JPG, JPEG, PNG formats
- Preserve original resolution (no resizing)
- Validate image is not corrupted

**Edge cases to handle**:
- Grayscale images → convert to RGB by duplicating channels
- CMYK images → convert to RGB
- Images with alpha channel → drop alpha, keep RGB
- Corrupted file bytes → raise `ValueError`

**Test criteria**:
- Loads rotated images correctly (EXIF orientation 3, 6, 8)
- Handles grayscale images
- Rejects corrupted files gracefully

---

#### Task 1.3: Detection Post-Processing
**File**: `src/core/postprocessing.py`

```python
"""
Implement the following functions:

def filter_detections(
    detections: List[Dict],
    confidence_threshold: float = 0.85,
    min_face_size: int = 20,
    image_shape: Tuple[int, int] = None
) -> List[Dict]:
    # Remove low confidence detections
    # Remove too-small faces
    # Clamp bboxes to image boundaries
    pass

def assign_face_indices(detections: List[Dict], sort_by: str = 'left_to_right') -> List[Dict]:
    # Sort detections by position or confidence
    # Add face_id field: "face_0", "face_1", etc.
    pass

def calculate_face_area(bbox: Dict) -> int:
    # Calculate area of bounding box
    pass
"""
```

**Requirements**:
- Filter out faces with `confidence < threshold`
- Filter out faces where `(x2-x1) < min_face_size` or `(y2-y1) < min_face_size`
- Clamp coordinates: `x1 = max(0, x1)`, `x2 = min(width, x2)`, etc.
- Support sorting by:
  - `left_to_right`: sort by x1 coordinate
  - `top_to_bottom`: sort by y1 coordinate  
  - `confidence`: sort by confidence score (descending)
  - `size`: sort by bbox area (descending)

**Test criteria**:
- Correctly filters low-confidence detections
- Face indices are deterministic (same order for same image)
- No bounding boxes exceed image dimensions

---

### PHASE 2: API Layer

#### Task 2.1: FastAPI Application
**File**: `src/api/main.py`

```python
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
```

**Request format**:
```bash
curl -X POST http://localhost:8000/api/v1/detect \
  -F "image=@classroom.jpg"
```

**Response format**:
```json
{
  "success": true,
  "image_id": "uuid-string",
  "metadata": {
    "width": 4032,
    "height": 3024,
    "num_faces_detected": 45,
    "processing_time_ms": 342
  },
  "faces": [
    {
      "face_id": "face_0",
      "bbox": {
        "x1": 120,
        "y1": 340,
        "x2": 280,
        "y2": 520
      },
      "landmarks": {
        "left_eye": [150, 390],
        "right_eye": [240, 385],
        "nose": [195, 440],
        "mouth_left": [165, 480],
        "mouth_right": [225, 478]
      },
      "confidence": 0.9876,
      "area_pixels": 25600
    }
  ]
}
```

**Error responses**:
```json
{
  "success": false,
  "error": {
    "code": "INVALID_FILE_TYPE",
    "message": "Only JPG, JPEG, PNG files are allowed"
  }
}
```

**Error codes to implement**:
- `INVALID_FILE_TYPE` (400)
- `FILE_TOO_LARGE` (400)
- `CORRUPTED_IMAGE` (422)
- `DETECTION_FAILED` (500)
- `MODEL_NOT_LOADED` (503)

---

#### Task 2.2: Request Validation
**File**: `src/api/validators.py`

```python
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
```

**Requirements**:
- Check file extension is in `['.jpg', '.jpeg', '.png']` (case-insensitive)
- Check file size ≤ max_size_mb
- Read file in chunks to avoid loading entire file into memory for size check
- Raise FastAPI `HTTPException` with appropriate status code

---

#### Task 2.3: API Configuration
**File**: `src/api/config.py`

```python
"""
Load configuration from environment variables using pydantic:

class Settings(BaseSettings):
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    max_file_size_mb: int = 15
    allowed_extensions: List[str] = ["jpg", "jpeg", "png"]
    
    detection_model: str = "retinaface"
    confidence_threshold: float = 0.85
    min_face_size: int = 20
    device: str = "cpu"
    
    log_level: str = "INFO"
    
    class Config:
        env_file = ".env"
"""
```

---

#### Task 2.4: Web Testing Interface
**File**: `static/index.html`

Create a simple HTML page to test the API without using curl.

**Requirements**:
- Single HTML file with embedded CSS and JavaScript (no external dependencies)
- Image upload form with drag-and-drop support
- Display uploaded image preview
- Send image to `/api/v1/detect` endpoint via JavaScript fetch
- Display detection results in a table format
- Show number of faces detected
- Display bounding boxes and confidence scores
- Show error messages if API call fails
- Responsive design (works on mobile and desktop)

**Features to implement**:
1. **Upload area**: Click to select or drag-and-drop image
2. **Image preview**: Show uploaded image before detection
3. **Detect button**: Trigger API call
4. **Loading state**: Show spinner while processing
5. **Results display**: Table with face_id, bbox coordinates, confidence
6. **Visual feedback**: Draw bounding boxes on image (optional but recommended)
7. **Error handling**: Show user-friendly error messages

**File structure**:
```
src/api/
└── static/
    └── index.html
```

**FastAPI static file serving**:
Add to `src/api/main.py`:
```python
from fastapi.staticfiles import StaticFiles

app.mount("/", StaticFiles(directory="src/api/static", html=True), name="static")
```

**Access the page**:
- Start API: `uvicorn src.api.main:app --reload`
- Open browser: `http://localhost:8000`

**Test workflow**:
1. Open `http://localhost:8000` in browser
2. Upload an image (click or drag-and-drop)
3. Click "Detect Faces" button
4. See results displayed below

---

### PHASE 3: Utilities

#### Task 3.1: Debug Visualization
**File**: `src/utils/visualize.py`

```python
"""
def draw_detections(image: np.ndarray, detections: List[Dict]) -> np.ndarray:
    # Draw green bounding boxes
    # Draw red landmark points
    # Add face_id labels
    # Return annotated image
    pass

def save_debug_image(image: np.ndarray, output_path: str) -> None:
    # Convert RGB to BGR for OpenCV
    # Save image to disk
    pass
"""
```

**Requirements**:
- Draw boxes with `cv2.rectangle()`, color green (0, 255, 0), thickness 2
- Draw landmarks with `cv2.circle()`, color red (255, 0, 0), radius 3
- Add text labels with `cv2.putText()`, font `cv2.FONT_HERSHEY_SIMPLEX`
- Label format: "face_0 (0.98)" where 0.98 is confidence
- Do NOT modify original image (work on copy)

---

#### Task 3.2: Logging Setup
**File**: `src/utils/logger.py`

```python
"""
Configure structured logging:

def setup_logger(name: str, level: str = "INFO") -> logging.Logger:
    # Create logger with formatting
    # Add console handler
    # Set log level
    pass
"""
```

**Log format**:
```
2024-02-10 14:23:45 | INFO | face_detector | Detected 23 faces in image_12345 (342ms)
```

**What to log**:
- API requests: method, endpoint, image_id
- Detection results: num_faces, processing_time_ms
- Errors: full stack trace in ERROR level
- Model loading: success/failure, device used

**What NOT to log**:
- Uploaded image bytes
- Full file paths (only filenames)
- Sensitive user data

---

### PHASE 4: Testing

#### Task 4.1: Unit Tests
**File**: `tests/test_face_detector.py`

```python
"""
Test cases to implement:

def test_single_face_detection():
    # Load test image with 1 face
    # Assert exactly 1 detection
    # Assert confidence > 0.85
    pass

def test_multi_face_detection():
    # Load test image with 10+ faces
    # Assert 10+ detections
    # Assert all face_ids are unique
    pass

def test_no_faces():
    # Load landscape/object image
    # Assert empty list returned
    pass

def test_confidence_filtering():
    # Mock detections with varying confidence
    # Assert low-confidence faces filtered
    pass

def test_bbox_clamping():
    # Mock detection with out-of-bounds bbox
    # Assert coordinates clamped to image size
    pass
"""
```

---

#### Task 4.2: Integration Tests
**File**: `tests/test_api.py`

```python
"""
Test API endpoints:

def test_detect_endpoint_success():
    # POST image to /api/v1/detect
    # Assert 200 status
    # Assert response schema correct
    pass

def test_invalid_file_type():
    # POST .txt file
    # Assert 400 status
    # Assert error code is INVALID_FILE_TYPE
    pass

def test_file_too_large():
    # POST 20MB image
    # Assert 400 status
    pass

def test_corrupted_image():
    # POST corrupted bytes
    # Assert 422 status
    pass
"""
```

---

### PHASE 5: Deployment Prep

#### Task 5.1: Docker Setup
**File**: `Dockerfile`

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY src/ ./src/
COPY .env .

EXPOSE 8000

CMD ["uvicorn", "src.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**File**: `docker-compose.yml`

```yaml
version: '3.8'

services:
  face-detection-api:
    build: .
    ports:
      - "8000:8000"
    environment:
      - DEVICE=cpu
      - CONFIDENCE_THRESHOLD=0.85
    volumes:
      - ./models:/app/models
    restart: unless-stopped
```

---

#### Task 5.2: Documentation
**File**: `README.md`

Should include:
- Project description
- Setup instructions (copy from this file)
- API usage examples with curl
- Configuration options
- Performance benchmarks
- Troubleshooting guide

**File**: `API_REFERENCE.md`

Should include:
- Endpoint documentation
- Request/response schemas
- Error codes reference
- Example responses for all scenarios

---

## EDGE CASES TO HANDLE

| Scenario | Expected Behavior | Status Code |
|----------|-------------------|-------------|
| No faces in image | Return `{"faces": []}` | 200 |
| 70+ faces detected | Return all valid detections | 200 |
| Grayscale image | Convert to RGB, process normally | 200 |
| Rotated image (EXIF) | Auto-rotate, detect faces | 200 |
| Non-image file (.txt) | Reject with error | 400 |
| File size > 15MB | Reject with error | 400 |
| Corrupted image bytes | Reject with error | 422 |
| Model loading failure | Return service unavailable | 503 |
| Detection timeout | Return error after 30s | 504 |

---

## PERFORMANCE TARGETS

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Detection time | <500ms for 4K image | Log processing_time_ms |
| Memory usage | <2GB per request | Use `memory_profiler` |
| Throughput | 10 concurrent requests | Use `locust` load testing |
| Model load time | <5s on startup | Log startup time |
| Accuracy | Detect 95%+ of visible faces | Manual testing on test set |

---

## TESTING CHECKLIST

Before deployment, verify:

- [ ] Detects single face correctly
- [ ] Detects 50+ faces in group photo
- [ ] Returns empty list for no-face images
- [ ] Handles rotated images (EXIF orientation)
- [ ] Rejects invalid file types
- [ ] Rejects oversized files
- [ ] Handles corrupted images gracefully
- [ ] Bounding boxes don't exceed image bounds
- [ ] Face indices are deterministic
- [ ] API returns correct error codes
- [ ] Processing time <500ms for typical images
- [ ] Memory doesn't leak over multiple requests
- [ ] Docker container builds successfully
- [ ] Health endpoint returns 200
- [ ] Web interface loads at http://localhost:8000
- [ ] Can upload image via web interface and see results

---

## WHAT NOT TO DO

❌ **Don't resize images before detection** unless the model explicitly requires it  
❌ **Don't load the model per request** - load once at startup  
❌ **Don't store uploaded images** - process in-memory only  
❌ **Don't use `face_recognition` library** - too slow for multi-face detection  
❌ **Don't crash on bad input** - always return proper error response  
❌ **Don't log image data** - only log metadata  
❌ **Don't block the event loop** - use async where appropriate  
❌ **Don't hardcode paths** - use environment variables  

---

## DELIVERABLES

### Code Files
- [ ] `src/core/face_detector.py` - Detection engine
- [ ] `src/core/image_processor.py` - Image loading
- [ ] `src/core/postprocessing.py` - Detection filtering
- [ ] `src/api/main.py` - FastAPI application
- [ ] `src/api/validators.py` - Request validation
- [ ] `src/api/config.py` - Configuration management
- [ ] `src/api/static/index.html` - Web testing interface
- [ ] `src/utils/visualize.py` - Debug visualization
- [ ] `src/utils/logger.py` - Logging setup

### Configuration Files
- [ ] `requirements.txt` - Python dependencies
- [ ] `.env` - Environment variables
- [ ] `Dockerfile` - Container definition
- [ ] `docker-compose.yml` - Service orchestration

### Tests
- [ ] `tests/test_face_detector.py` - Unit tests
- [ ] `tests/test_api.py` - Integration tests
- [ ] `tests/conftest.py` - Pytest fixtures

### Documentation
- [ ] `README.md` - Setup and usage guide
- [ ] `API_REFERENCE.md` - API documentation
- [ ] `CHANGELOG.md` - Version history

### Test Data
- [ ] `data/test_images/single_face.jpg`
- [ ] `data/test_images/group_photo_10.jpg`
- [ ] `data/test_images/group_photo_50.jpg`
- [ ] `data/test_images/no_faces.jpg`
- [ ] `data/test_images/rotated.jpg`

---

## IMPLEMENTATION ORDER SUMMARY

1. **Setup** (30 min)
   - Create project structure
   - Install dependencies
   - Verify setup

2. **Core Detection** (3-4 hours)
   - Implement FaceDetector class
   - Implement image loading
   - Implement post-processing

3. **API Layer** (2-3 hours)
   - Create FastAPI endpoints
   - Add validation
   - Configure settings
   - Create web testing interface

4. **Utilities** (1 hour)
   - Debug visualization
   - Logging setup

5. **Testing** (2 hours)
   - Write unit tests
   - Write integration tests
   - Create test data

6. **Documentation** (1 hour)
   - Write README
   - Write API reference

7. **Deployment** (1 hour)
   - Create Dockerfile
   - Test Docker build
   - Final verification

**Total estimated time**: 10-13 hours

---

## SUCCESS CRITERIA

The face detection pipeline is complete when:

1. ✅ API accepts image uploads and returns face detections
2. ✅ Detects 70+ faces in a group photo reliably
3. ✅ Processing time <500ms for typical images
4. ✅ All tests pass
5. ✅ Docker container runs successfully
6. ✅ API documentation is complete
7. ✅ Error handling covers all edge cases
8. ✅ No memory leaks over 100+ requests

---

## NEXT STEPS AFTER COMPLETION

Once face detection works:
1. Add face cropping module
2. Add face alignment module  
3. Integrate face embedding extraction
4. Build face matching/recognition layer
5. Add database for storing embeddings
6. Build attendance tracking logic

But **DO NOT** start these until face detection is verified working correctly.
