"""
Strategy Upload Handler
Handles uploading, validating, and managing trading strategy files
"""
import os
import re
import ast
import shutil
from pathlib import Path
from typing import Optional, Tuple
from datetime import datetime
from logger import setup_logger

logger = setup_logger("StrategyUpload", "INFO")

# Configuration
STRATEGIES_DIR = Path(__file__).parent / "strategies"
MARKETPLACE_DIR = STRATEGIES_DIR / "marketplace"
MAX_FILE_SIZE = 1 * 1024 * 1024  # 1MB
ALLOWED_EXTENSIONS = ['.py']


class StrategyUploadHandler:
    """Handles strategy file uploads and validation"""
    
    def __init__(self):
        """Initialize the upload handler"""
        self.ensure_directories()
    
    def ensure_directories(self):
        """Ensure required directories exist"""
        MARKETPLACE_DIR.mkdir(parents=True, exist_ok=True)
        logger.info(f"Strategy directories ready: {STRATEGIES_DIR}")
    
    def validate_file(self, file_content: bytes, filename: str) -> Tuple[bool, Optional[str]]:
        """
        Validate uploaded strategy file
        
        Args:
            file_content: File content in bytes
            filename: Original filename
        
        Returns:
            Tuple of (is_valid, error_message)
        """
        # Check file extension
        if not any(filename.lower().endswith(ext) for ext in ALLOWED_EXTENSIONS):
            return False, f"Invalid file type. Only {', '.join(ALLOWED_EXTENSIONS)} files are allowed"
        
        # Check file size
        if len(file_content) > MAX_FILE_SIZE:
            return False, f"File too large. Maximum size is {MAX_FILE_SIZE / 1024 / 1024}MB"
        
        # Validate Python syntax
        try:
            file_str = file_content.decode('utf-8')
            ast.parse(file_str)
        except UnicodeDecodeError:
            return False, "File must be valid UTF-8 encoded text"
        except SyntaxError as e:
            return False, f"Invalid Python syntax: {str(e)}"
        
        # Check if file contains a class definition
        if not re.search(r'class\s+\w+', file_str):
            return False, "File must contain at least one class definition"
        
        return True, None
    
    def extract_class_info(self, file_content: bytes) -> Tuple[Optional[str], Optional[str]]:
        """
        Extract the main strategy class name and check if it extends BaseStrategy
        
        Args:
            file_content: File content in bytes
        
        Returns:
            Tuple of (class_name, parent_class)
        """
        try:
            file_str = file_content.decode('utf-8')
            tree = ast.parse(file_str)
            
            # Find all class definitions
            classes = [node for node in ast.walk(tree) if isinstance(node, ast.ClassDef)]
            
            if not classes:
                return None, None
            
            # Look for classes that inherit from BaseStrategy
            for cls in classes:
                if cls.bases:
                    for base in cls.bases:
                        base_name = None
                        if isinstance(base, ast.Name):
                            base_name = base.id
                        elif isinstance(base, ast.Attribute):
                            base_name = base.attr
                        
                        if base_name and 'BaseStrategy' in base_name:
                            return cls.name, base_name
            
            # If no BaseStrategy found, return the first class
            return classes[0].name, None
            
        except Exception as e:
            logger.error(f"Failed to extract class info: {e}")
            return None, None
    
    def generate_strategy_id(self, name: str) -> str:
        """
        Generate a unique strategy ID from the strategy name
        
        Args:
            name: Strategy name
        
        Returns:
            Unique strategy ID
        """
        # Sanitize and convert to snake_case
        sanitized = re.sub(r'[^\w\s-]', '', name.lower())
        sanitized = re.sub(r'[-\s]+', '_', sanitized)
        
        # Add timestamp for uniqueness
        timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
        
        return f"{sanitized}_{timestamp}"
    
    def sanitize_filename(self, filename: str) -> str:
        """
        Sanitize filename to be filesystem-safe
        
        Args:
            filename: Original filename
        
        Returns:
            Sanitized filename
        """
        # Remove extension
        name = Path(filename).stem
        
        # Replace spaces and special chars with underscore
        sanitized = re.sub(r'[^\w\s-]', '', name.lower())
        sanitized = re.sub(r'[-\s]+', '_', sanitized)
        
        # Add .py extension
        return f"{sanitized}.py"
    
    def save_strategy_file(
        self,
        file_content: bytes,
        filename: str,
        is_paid: bool
    ) -> Tuple[bool, Optional[str], Optional[str]]:
        """
        Save strategy file to appropriate directory
        
        Args:
            file_content: File content in bytes
            filename: Original filename
            is_paid: Whether this is a paid strategy
        
        Returns:
            Tuple of (success, file_path, error_message)
        """
        try:
            # Sanitize filename
            safe_filename = self.sanitize_filename(filename)
            
            # Make filename unique by adding timestamp if it exists
            target_dir = MARKETPLACE_DIR if is_paid else STRATEGIES_DIR
            target_path = target_dir / safe_filename
            
            if target_path.exists():
                timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
                name = Path(safe_filename).stem
                safe_filename = f"{name}_{timestamp}.py"
                target_path = target_dir / safe_filename
            
            # Write file
            with open(target_path, 'wb') as f:
                f.write(file_content)
            
            # Calculate relative path from project root (trading-service directory)
            project_root = Path(__file__).parent
            relative_path = target_path.relative_to(project_root)
            
            logger.info(f"Saved strategy file: {relative_path}")
            return True, str(relative_path), None
            
        except Exception as e:
            logger.error(f"Failed to save strategy file: {e}")
            return False, None, str(e)
    
    def delete_strategy_file(self, file_path: str) -> bool:
        """
        Delete a strategy file
        
        Args:
            file_path: Relative path to the strategy file
        
        Returns:
            True if deleted successfully
        """
        try:
            full_path = STRATEGIES_DIR / file_path
            
            if full_path.exists():
                full_path.unlink()
                logger.info(f"Deleted strategy file: {file_path}")
                return True
            else:
                logger.warning(f"Strategy file not found: {file_path}")
                return False
                
        except Exception as e:
            logger.error(f"Failed to delete strategy file: {e}")
            return False
    
    def get_module_path(self, file_path: str) -> str:
        """
        Convert file path to Python module path
        
        Args:
            file_path: Relative file path (e.g., 'marketplace/my_strategy.py')
        
        Returns:
            Module path (e.g., 'strategies.marketplace.my_strategy')
        """
        # Remove .py extension
        path_obj = Path(file_path)
        module_parts = list(path_obj.parts[:-1]) + [path_obj.stem]
        
        # Add 'strategies' prefix
        return 'strategies.' + '.'.join(module_parts)
    
    def read_strategy_file(self, file_path: str) -> Optional[str]:
        """
        Read strategy file content
        
        Args:
            file_path: Relative path to the strategy file
        
        Returns:
            File content as string or None if error
        """
        try:
            full_path = STRATEGIES_DIR / file_path
            
            if not full_path.exists():
                logger.error(f"Strategy file not found: {file_path}")
                return None
            
            with open(full_path, 'r', encoding='utf-8') as f:
                return f.read()
                
        except Exception as e:
            logger.error(f"Failed to read strategy file: {e}")
            return None
