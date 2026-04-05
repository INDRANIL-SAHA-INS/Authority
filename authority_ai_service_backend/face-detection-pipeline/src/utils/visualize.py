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

import cv2
import numpy as np
from typing import List, Dict

def draw_detections(image: np.ndarray, detections: List[Dict]) -> np.ndarray:
    img = image.copy()
    for det in detections:
        bbox = det['bbox']
        x1, y1, x2, y2 = bbox['x1'], bbox['y1'], bbox['x2'], bbox['y2']
        cv2.rectangle(img, (x1, y1), (x2, y2), (0, 255, 0), 2)
        landmarks = det.get('landmarks', {})
        for key, point in landmarks.items():
            cv2.circle(img, tuple(point), 3, (255, 0, 0), -1)
        label = f"{det.get('face_id', '')} ({det.get('confidence', 0):.2f})"
        cv2.putText(img, label, (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
    return img

def save_debug_image(image: np.ndarray, output_path: str) -> None:
    img_bgr = cv2.cvtColor(image, cv2.COLOR_RGB2BGR)
    cv2.imwrite(output_path, img_bgr)
