import uvicorn
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from guardian.backend.config import settings
from guardian.backend.db import init_db
from guardian.backend.api.moderation import router as moderation_router
from guardian.backend.api.analytics import router as analytics_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize the database and create tables on startup
    await init_db()
    yield

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Backend API for Reddit Guardian AI Moderation Copilot",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS
# Devvit runs on Reddit domains, but HTTP requests can originate from Reddit's servers.
# To allow playtesting and local dev, we open up CORS.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Routers
app.include_router(moderation_router)
app.include_router(analytics_router)

@app.get("/")
async def root():
    return {
        "status": "online",
        "project": settings.PROJECT_NAME,
        "message": "Guardian is watching and protecting."
    }

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=True
    )
