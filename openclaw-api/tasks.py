"""
Task Queue für asynchrone Verarbeitung

In-Memory Queue für Tasks mit Polling-Support
"""

import uuid
from datetime import datetime
from typing import Dict, Optional, Any
from dataclasses import dataclass, field, asdict
from enum import Enum


class TaskStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class Task:
    id: str
    instruction: str
    context: Dict[str, Any]
    status: TaskStatus = TaskStatus.QUEUED
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.now)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON response"""
        return {
            "task_id": self.id,
            "status": self.status.value,
            "result": self.result,
            "error": self.error,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None
        }


class TaskQueue:
    """In-Memory Task Queue"""
    
    def __init__(self):
        self.tasks: Dict[str, Task] = {}
    
    def create(self, instruction: str, context: Dict[str, Any]) -> str:
        """Create new task and return task_id"""
        task_id = str(uuid.uuid4())
        task = Task(
            id=task_id,
            instruction=instruction,
            context=context
        )
        self.tasks[task_id] = task
        return task_id
    
    def get(self, task_id: str) -> Optional[Task]:
        """Get task by ID"""
        return self.tasks.get(task_id)
    
    def update_status(self, task_id: str, status: TaskStatus, result: Dict[str, Any] = None, error: str = None):
        """Update task status"""
        task = self.tasks.get(task_id)
        if task:
            task.status = status
            if result:
                task.result = result
            if error:
                task.error = error
            if status == TaskStatus.RUNNING:
                task.started_at = datetime.now()
            elif status in [TaskStatus.COMPLETED, TaskStatus.FAILED]:
                task.completed_at = datetime.now()
    
    def cleanup_old_tasks(self, max_age_hours: int = 24):
        """Remove tasks older than max_age_hours"""
        now = datetime.now()
        to_remove = []
        for task_id, task in self.tasks.items():
            if task.created_at:
                age = (now - task.created_at).total_seconds() / 3600
                if age > max_age_hours and task.status in [TaskStatus.COMPLETED, TaskStatus.FAILED]:
                    to_remove.append(task_id)
        
        for task_id in to_remove:
            del self.tasks[task_id]
        
        return len(to_remove)


# Global task queue instance
task_queue = TaskQueue()
