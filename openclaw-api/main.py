"""
OpenClaw REST API Server

Main server entry point with Async Task Queue + Polling Support
"""

import logging
from typing import Any, Dict, Optional
from fastapi import FastAPI, HTTPException, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
import uvicorn
import asyncio

from config import get_settings, Settings
from commands import OpenClawCommandHandler, CommandResult
from tasks import task_queue, TaskStatus

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize settings
settings = get_settings()

# Initialize FastAPI app
app = FastAPI(
    title="OpenClaw REST API",
    description="REST API for OpenClaw hardware control with Async Task Queue",
    version="2.0.0"
)

# Configure CORS
cors_origins = settings.CORS_ORIGINS
if cors_origins == "*":
    cors_origins_list = ["*"]
else:
    cors_origins_list = [origin.strip() for origin in cors_origins.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins_list,
    allow_credentials=True,
    allow_methods=settings.CORS_ALLOW_METHODS.split(","),
    allow_headers=settings.CORS_ALLOW_HEADERS.split(","),
)

# Initialize command handler
command_handler = OpenClawCommandHandler()


# ==================== REQUEST/RESPONSE MODELS ====================

class CommandRequest(BaseModel):
    """Request model for /api/command endpoint"""
    instruction: Optional[str] = Field(None, description="Natural language instruction")
    context: Dict[str, Any] = Field(default_factory=dict, description="Context data")
    command: Optional[str] = Field(None, description="Direct command (legacy)")
    parameters: Dict[str, Any] = Field(default_factory=dict, description="Command parameters (legacy)")


class CommandResponse(BaseModel):
    """Response model for /api/command endpoint"""
    status: str = Field(..., description="success, error, or queued")
    message: str = Field(..., description="Response message")
    data: Dict[str, Any] = Field(default_factory=dict, description="Response data")
    error: Optional[str] = Field(None, description="Error message if failed")


# ==================== MIDDLEWARE ====================

@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log all incoming requests"""
    logger.info(f"{request.method} {request.url.path}")
    response = await call_next(request)
    logger.info(f"Response status: {response.status_code}")
    return response


# ==================== AUTHENTICATION ====================

async def verify_api_key(authorization: Optional[str] = None) -> bool:
    """Verify API key from Authorization header"""
    if not settings.AUTH_ENABLED:
        return True
    
    if not authorization:
        return False
    
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return False
    
    return parts[1] == settings.API_KEY


# ==================== BACKGROUND TASK PROCESSING ====================

async def process_task_background(task_id: str, instruction: str, context: Dict[str, Any]):
    """Process task in background"""
    try:
        task_queue.update_status(task_id, TaskStatus.RUNNING)
        logger.info(f"Task {task_id}: Processing instruction...")
        
        result = await command_handler.process_instruction(
            instruction=instruction,
            context=context
        )
        
        task_queue.update_status(task_id, TaskStatus.COMPLETED, result.to_dict())
        logger.info(f"Task {task_id}: Completed successfully")
        
    except Exception as e:
        logger.error(f"Task {task_id}: Failed - {e}")
        task_queue.update_status(task_id, TaskStatus.FAILED, error=str(e))


# ==================== API ENDPOINTS ====================

@app.post("/api/command")
async def execute_command(
    request: CommandRequest,
    authorization: Optional[str] = Header(None)
):
    """
    Execute OpenClaw command (ASYNC with Polling)
    
    Creates a task and returns task_id immediately.
    Poll status at GET /api/task/{task_id}
    """
    # Verify authentication
    if settings.AUTH_ENABLED:
        if not await verify_api_key(authorization):
            raise HTTPException(status_code=401, detail="Unauthorized")
    
    # Create task
    task_id = task_queue.create(
        instruction=request.instruction or request.command or "Unknown",
        context=request.context or request.parameters or {}
    )
    
    logger.info(f"Task {task_id}: Created")
    
    # Start background processing
    asyncio.create_task(process_task_background(
        task_id,
        request.instruction or request.command or "Unknown",
        request.context or request.parameters or {}
    ))
    
    # Return task_id immediately
    return CommandResponse(
        status="queued",
        message="Task wurde in die Warteschlange aufgenommen",
        data={"task_id": task_id}
    )


@app.get("/api/task/{task_id}")
async def get_task_status(task_id: str):
    """Get task status and result"""
    task = task_queue.get(task_id)
    
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    return task.to_dict()


@app.get("/api/tasks")
async def list_tasks():
    """List all tasks (for debugging)"""
    return {
        "tasks": [task.to_dict() for task in task_queue.tasks.values()],
        "count": len(task_queue.tasks)
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "version": "2.0.0",
        "auth_enabled": settings.AUTH_ENABLED,
        "cors_origins": settings.CORS_ORIGINS,
        "tasks_queued": len(task_queue.tasks)
    }


@app.get("/")
async def root():
    """API information"""
    return {
        "name": "OpenClaw REST API",
        "version": "2.0.0",
        "endpoints": {
            "POST /api/command": "Create task (returns task_id)",
            "GET /api/task/{task_id}": "Get task status",
            "GET /api/tasks": "List all tasks",
            "GET /health": "Health check"
        },
        "docs": "/docs"
    }


# ==================== ERROR HANDLERS ====================

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Handle HTTP exceptions"""
    logger.warning(f"HTTP {exc.status_code}: {exc.detail}")
    return JSONResponse(
        status_code=exc.status_code,
        content={"status": "error", "message": exc.detail}
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle general exceptions"""
    logger.error(f"Unhandled exception: {exc}")
    return JSONResponse(
        status_code=500,
        content={"status": "error", "message": "Internal server error"}
    )


# ==================== MAIN ENTRY POINT ====================

if __name__ == "__main__":
    logger.info("Starting OpenClaw REST API Server v2.0 (Async with Polling)...")
    logger.info(f"Host: {settings.HOST}")
    logger.info(f"Port: {settings.PORT}")
    logger.info(f"Auth Enabled: {settings.AUTH_ENABLED}")
    
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        log_level=settings.OPENCLAW_LOG_LEVEL.lower()
    )
