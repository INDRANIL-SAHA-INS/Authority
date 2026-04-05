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

from pydantic import validator
from pydantic_settings import BaseSettings
from typing import List, Union

class Settings(BaseSettings):
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    max_file_size_mb: int = 15
    allowed_extensions: List[str] = ["jpg", "jpeg", "png"]

    @validator("allowed_extensions", pre=True)
    def decode_list(v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            return [x.strip() for x in v.split(",")]
        return v
    
    # DeepFace AI Settings
    detection_model: str = "retinaface"
    recognition_model: str = "ArcFace"
    registration_confidence_threshold: float = 0.80 # Stricter for enrollment
    match_confidence_threshold: float = 0.85 # Used for attendance matching
    
    min_face_size: int = 20
    device: str = "cpu"
    log_level: str = "INFO"

    model_config = {
        "env_file": ".env",
        "extra": "ignore"
    }
