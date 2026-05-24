import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from .env file
env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=env_path)

class Settings:
    PROJECT_NAME: str = "Guardian AI Moderator Backend"
    
    # API Configurations
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    
    # Server Configurations
    HOST: str = os.getenv("HOST", "127.0.0.1")
    PORT: int = int(os.getenv("PORT", "8000"))
    
    # Database Configuration (Defaults to local SQLite file)
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./guardian.db")
    
    # Moderation Thresholds
    TOXICITY_THRESHOLD: float = float(os.getenv("TOXICITY_THRESHOLD", "0.75"))
    SPAM_THRESHOLD: float = float(os.getenv("SPAM_THRESHOLD", "0.80"))
    DUPLICATE_THRESHOLD: float = float(os.getenv("DUPLICATE_THRESHOLD", "0.85"))
    
    # Safety Check Configuration
    DUPLICATE_CHECK_DAYS: int = int(os.getenv("DUPLICATE_CHECK_DAYS", "30"))

settings = Settings()
