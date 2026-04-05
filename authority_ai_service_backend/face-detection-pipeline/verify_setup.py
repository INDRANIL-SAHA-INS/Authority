import cv2
import numpy as np
from PIL import Image

print("OpenCV version:", cv2.__version__)
print("NumPy version:", np.__version__)
print("PIL version:", Image.__version__)

# Test basic image operations
test_img = np.zeros((100, 100, 3), dtype=np.uint8)
print("\u2713 NumPy array creation works")

# Test OpenCV
gray = cv2.cvtColor(test_img, cv2.COLOR_RGB2GRAY)
print("\u2713 OpenCV operations work")

print("\n\u2713 Setup complete!")
