"""
OpenClaw API Server Configuration

Environment variables are loaded from .env file
"""

from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """Server configuration"""
    
    # Server Settings
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    DEBUG: bool = True
    
    # CORS Settings
    CORS_ORIGINS: str = "*"  # Comma-separated list or "*" for all
    CORS_ALLOW_METHODS: str = "POST,OPTIONS"
    CORS_ALLOW_HEADERS: str = "Content-Type,Authorization"
    
    # Authentication
    API_KEY: Optional[str] = None  # If None, auth is disabled
    AUTH_ENABLED: bool = False
    
    # OpenClaw Settings
    OPENCLAW_WORKSPACE: str = "/root/.openclaw/workspace"
    OPENCLAW_LOG_LEVEL: str = "INFO"
    
    class Config:
        env_file = ".env"
        case_sensitive = True


# Global settings instance
settings = Settings()


def get_settings() -> Settings:
    """Get global settings instance"""
    return settings
