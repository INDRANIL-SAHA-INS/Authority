"""
Configure structured logging:

def setup_logger(name: str, level: str = "INFO") -> logging.Logger:
    # Create logger with formatting
    # Add console handler
    # Set log level
    pass
"""

import logging

def setup_logger(name: str, level: str = "INFO") -> logging.Logger:
    logger = logging.getLogger(name)
    logger.setLevel(level.upper())
    formatter = logging.Formatter('%(asctime)s | %(levelname)s | %(name)s | %(message)s', '%Y-%m-%d %H:%M:%S')
    ch = logging.StreamHandler()
    ch.setFormatter(formatter)
    logger.handlers = []  # Remove any existing handlers
    logger.addHandler(ch)
    return logger
