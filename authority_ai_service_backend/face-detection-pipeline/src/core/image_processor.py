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

import cv2
import numpy as np
from PIL import Image, ImageOps
from io import BytesIO
from typing import Dict

def load_image(file_path: str) -> np.ndarray:
    try:
        # Load with PIL for EXIF
        pil_img = Image.open(file_path)
        pil_img = ImageOps.exif_transpose(pil_img)
        # Convert to RGB
        if pil_img.mode == 'L':  # Grayscale
            pil_img = pil_img.convert('RGB')
        elif pil_img.mode == 'CMYK':
            pil_img = pil_img.convert('RGB')
        elif pil_img.mode == 'RGBA':
            pil_img = pil_img.convert('RGB')
        # Convert to numpy
        img_np = np.array(pil_img)
        # OpenCV expects BGR, convert to RGB
        if img_np.shape[-1] == 3:
            img_np = cv2.cvtColor(img_np, cv2.COLOR_BGR2RGB)
        return img_np
    except Exception as e:
        raise ValueError(f"Failed to load image: {e}")

def validate_image(file_bytes: bytes, max_size_mb: int = 15) -> bool:
    if len(file_bytes) > max_size_mb * 1024 * 1024:
        return False
    try:
        pil_img = Image.open(BytesIO(file_bytes))
        pil_img.verify()  # Check for corruption
        return True
    except Exception:
        return False

def get_image_metadata(image: np.ndarray) -> Dict:
    h, w = image.shape[:2]
    c = image.shape[2] if image.ndim == 3 else 1
    aspect_ratio = w / h if h != 0 else 0
    return {
        'height': h,
        'width': w,
        'channels': c,
        'aspect_ratio': aspect_ratio
    }
