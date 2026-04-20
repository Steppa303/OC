"""
Base Command Handler

All command handlers must inherit from BaseCommandHandler
"""

from abc import ABC, abstractmethod
from typing import Any, Dict, Optional
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


class CommandResult:
    """Result of a command execution"""
    
    def __init__(
        self,
        success: bool,
        message: str,
        data: Optional[Dict[str, Any]] = None,
        error: Optional[str] = None
    ):
        self.success = success
        self.message = message
        self.data = data or {}
        self.error = error
        self.timestamp = datetime.now().isoformat()
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON response"""
        return {
            "success": self.success,
            "message": self.message,
            "data": self.data,
            "error": self.error,
            "timestamp": self.timestamp
        }


class BaseCommandHandler(ABC):
    """
    Abstract base class for all command handlers
    
    Implement execute() method in your command handler
    """
    
    def __init__(self):
        self.logger = logging.getLogger(self.__class__.__name__)
    
    @abstractmethod
    async def execute(self, parameters: Dict[str, Any]) -> CommandResult:
        """
        Execute the command
        
        Args:
            parameters: Command parameters from request
            
        Returns:
            CommandResult with success/failure status
        """
        pass
    
    def validate_parameters(self, parameters: Dict[str, Any]) -> bool:
        """
        Validate command parameters before execution
        
        Override in subclass for custom validation
        
        Returns:
            True if valid, False otherwise
        """
        return True
