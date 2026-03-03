"""
Logging configuration for the trading bot.
Provides colored console output and file logging.
"""
import logging
import os
from datetime import datetime
import colorlog


def setup_logger(name: str = "TradingBot", level: str = None, environment: str = None) -> logging.Logger:

    # Create logs directory if it doesn't exist
    os.makedirs("logs", exist_ok=True)
    
    # Auto-detect log level based on environment if not specified
    if level is None:
        if environment is None:
            environment = os.getenv('TRADING_ENVIRONMENT', 'testnet').lower()
        # Production: INFO level (clean logs), Others: DEBUG level (verbose for debugging)
        level = 'INFO' if environment == 'production' else 'DEBUG'
    
    # Create logger
    logger = logging.getLogger(name)
    logger.setLevel(getattr(logging, level.upper()))
    
    # Prevent duplicate handlers
    if logger.handlers:
        return logger
    
    # Console handler with color
    console_handler = colorlog.StreamHandler()
    console_handler.setLevel(logging.DEBUG)
    
    console_format = colorlog.ColoredFormatter(
        "%(log_color)s%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
        log_colors={
            'DEBUG': 'cyan',
            'INFO': 'green',
            'WARNING': 'yellow',
            'ERROR': 'red',
            'CRITICAL': 'red,bg_white',
        }
    )
    console_handler.setFormatter(console_format)
    
    # File handler
    log_filename = f"logs/trading_bot_{datetime.now().strftime('%Y%m%d')}.log"
    file_handler = logging.FileHandler(log_filename)
    file_handler.setLevel(logging.DEBUG)
    
    file_format = logging.Formatter(
        "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )
    file_handler.setFormatter(file_format)
    
    # Add handlers to logger
    logger.addHandler(console_handler)
    logger.addHandler(file_handler)
    
    return logger
