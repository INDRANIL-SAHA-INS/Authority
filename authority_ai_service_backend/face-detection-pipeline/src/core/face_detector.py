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

import numpy as np
from typing import List, Dict
import tempfile
import os
import cv2

class FaceDetector:
    def __init__(self, model_name='retinaface', device='cpu', confidence_threshold=0.85):
        self.model_name = model_name
        self.device = device
        self.confidence_threshold = confidence_threshold
        self.model = None
        try:
            if model_name == 'retinaface':
                from retinaface import RetinaFace
                self.model = RetinaFace  # Assign the class, not an instance
            elif model_name == 'mtcnn':
                from facenet_pytorch import MTCNN
                self.model = MTCNN(device=device)
            elif model_name == 'mediapipe':
                import mediapipe as mp
                self.model = mp.solutions.face_detection.FaceDetection(min_detection_confidence=confidence_threshold)
            else:
                raise ValueError(f"Unsupported model: {model_name}")
        except Exception as e:
            raise RuntimeError(f"Failed to load model '{model_name}': {e}")

    def detect(self, image: np.ndarray) -> List[Dict]:
        if self.model is None:
            raise RuntimeError("Model not loaded")
        
        # Store image dimensions early
        if not isinstance(image, np.ndarray):
            raise RuntimeError("Image must be a numpy array")
        
        h, w = image.shape[:2]
        detections = []
        
        try:
            if self.model_name == 'retinaface':
                # RetinaFace.detect_faces() expects a file path
                # Save numpy array to temporary file
                with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp:
                    cv2.imwrite(tmp.name, image)
                    temp_path = tmp.name
                
                try:
                    # Call RetinaFace.detect_faces with the file path
                    results = self.model.detect_faces(temp_path)
                    
                    if results is None or len(results) == 0:
                        return []
                    
                    # Parse results from retinaface
                    for key, face in results.items():
                        if key == 'error':
                            continue
                        bbox = face['facial_area']
                        landmarks = face['landmarks']
                        confidence = face.get('score', 1.0)
                        
                        # Filter by confidence threshold
                        if confidence < self.confidence_threshold:
                            continue
                        
                        detections.append({
                            'bbox': {
                                'x1': int(bbox[0]), 'y1': int(bbox[1]),
                                'x2': int(bbox[2]), 'y2': int(bbox[3])
                            },
                            'landmarks': {
                                'left_eye': list(map(int, landmarks['left_eye'])),
                                'right_eye': list(map(int, landmarks['right_eye'])),
                                'nose': list(map(int, landmarks['nose'])),
                                'mouth_left': list(map(int, landmarks['mouth_left'])),
                                'mouth_right': list(map(int, landmarks['mouth_right']))
                            },
                            'confidence': float(confidence)
                        })
                finally:
                    # Clean up temporary file
                    if os.path.exists(temp_path):
                        os.remove(temp_path)
            
            elif self.model_name == 'mtcnn':
                from facenet_pytorch import MTCNN
                mtcnn = self.model
                boxes, probs, landmarks = mtcnn.detect(image, landmarks=True)
                if boxes is None:
                    return []
                for i, box in enumerate(boxes):
                    if probs[i] < self.confidence_threshold:
                        continue
                    detections.append({
                        'bbox': {
                            'x1': int(box[0]), 'y1': int(box[1]),
                            'x2': int(box[2]), 'y2': int(box[3])
                        },
                        'landmarks': {
                            'left_eye': list(map(int, landmarks[i][0])),
                            'right_eye': list(map(int, landmarks[i][1])),
                            'nose': list(map(int, landmarks[i][2])),
                            'mouth_left': list(map(int, landmarks[i][3])),
                            'mouth_right': list(map(int, landmarks[i][4]))
                        },
                        'confidence': float(probs[i])
                    })
            
            elif self.model_name == 'mediapipe':
                import mediapipe as mp
                # Convert BGR to RGB for MediaPipe
                image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
                mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=image_rgb)
                results = self.model.process(mp_image)
                if not results.detections:
                    return []
                for detection in results.detections:
                    bboxC = detection.location_data.relative_bounding_box
                    x1 = int(bboxC.xmin * w)
                    y1 = int(bboxC.ymin * h)
                    x2 = int((bboxC.xmin + bboxC.width) * w)
                    y2 = int((bboxC.ymin + bboxC.height) * h)
                    # MediaPipe face detection provides limited keypoints
                    landmarks = {}
                    if detection.location_data.relative_keypoints:
                        for i, lm in enumerate(detection.location_data.relative_keypoints):
                            lm_x = int(lm.x * w)
                            lm_y = int(lm.y * h)
                            if i == 0:
                                landmarks['left_eye'] = [lm_x, lm_y]
                            elif i == 1:
                                landmarks['right_eye'] = [lm_x, lm_y]
                            elif i == 2:
                                landmarks['nose'] = [lm_x, lm_y]
                            elif i == 3:
                                landmarks['mouth_left'] = [lm_x, lm_y]
                            elif i == 4:
                                landmarks['mouth_right'] = [lm_x, lm_y]
                    detections.append({
                        'bbox': {'x1': x1, 'y1': y1, 'x2': x2, 'y2': y2},
                        'landmarks': landmarks,
                        'confidence': float(detection.score[0])
                    })
            
            else:
                raise RuntimeError("Unsupported model")
        
        except Exception as e:
            raise RuntimeError(f"Detection failed: {e}")
        
        return detections
