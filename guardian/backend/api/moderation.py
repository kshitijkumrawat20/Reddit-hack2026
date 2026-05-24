import logging
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import select, desc
from sqlmodel.ext.asyncio.session import AsyncSession

from guardian.backend.db import get_session
from guardian.backend.models import (
    ContentSubmission,
    ResolutionRequest,
    FeedbackRequest,
    ModerationLog,
    QueueResponse
)
from guardian.backend.moderation.detector import ModerationDetector

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/moderation", tags=["moderation"])

@router.post("/check", response_model=QueueResponse)
async def check_submission(
    submission: ContentSubmission,
    db: AsyncSession = Depends(get_session)
):
    """Checks a post or comment submission, runs AI moderation, and stores logs."""
    try:
        # Check if already processed
        existing = await db.get(ModerationLog, submission.id)
        if existing:
            # If already processed, return existing log (or re-evaluate)
            return existing
            
        # Run detection pipeline
        log = await ModerationDetector.analyze_submission(db, submission)
        
        # Add to database
        db.add(log)
        await db.commit()
        await db.refresh(log)
        
        return log
    except Exception as e:
        logger.error(f"Error checking submission {submission.id}: {e}")
        raise HTTPException(status_code=500, detail=f"Moderation check failed: {str(e)}")

@router.get("/queue", response_model=List[QueueResponse])
async def get_moderation_queue(
    subreddit: str,
    db: AsyncSession = Depends(get_session)
):
    """Fetches the prioritized moderation queue for a specific subreddit."""
    try:
        # Select flagged items that have not been resolved
        stmt = (
            select(ModerationLog)
            .where(ModerationLog.subreddit == subreddit)
            .where(ModerationLog.status == "flagged")
        )
        
        result = await db.execute(stmt)
        items = result.scalars().all()
        
        # Priority mapping for sorting
        priority_map = {"high": 3, "medium": 2, "low": 1}
        
        # Sort by priority level (high -> medium -> low), then by created_at desc
        sorted_items = sorted(
            items,
            key=lambda x: (priority_map.get(x.priority, 0), x.created_at),
            reverse=True
        )
        
        return sorted_items
    except Exception as e:
        logger.error(f"Error fetching queue for subreddit {subreddit}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/resolve")
async def resolve_item(
    request: ResolutionRequest,
    db: AsyncSession = Depends(get_session)
):
    """Resolves a flagged queue item (approves, removes, ignores, warns)."""
    try:
        log = await db.get(ModerationLog, request.id)
        if not log:
            raise HTTPException(status_code=404, detail="Moderation log item not found")
            
        # Map actions to log statuses
        action_map = {
            "approve": "approved",
            "remove": "removed",
            "ignore": "ignored",
            "warn": "warned"
        }
        
        new_status = action_map.get(request.action.lower())
        if not new_status:
            raise HTTPException(status_code=400, detail=f"Invalid resolution action: {request.action}")
            
        log.status = new_status
        log.resolved_at = datetime.now(timezone.utc)
        log.resolved_by = request.moderator
        
        db.add(log)
        await db.commit()
        
        logger.info(f"Subreddit item {request.id} resolved as '{new_status}' by mod {request.moderator}")
        return {"status": "success", "resolved_id": request.id, "new_status": new_status}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error resolving item {request.id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/feedback")
async def submit_feedback(
    request: FeedbackRequest,
    db: AsyncSession = Depends(get_session)
):
    """Allows moderators to flag false positives and rate AI accuracy."""
    try:
        log = await db.get(ModerationLog, request.id)
        if not log:
            raise HTTPException(status_code=404, detail="Moderation log item not found")
            
        log.feedback_correct = request.is_correct
        log.feedback_reason = request.reason
        
        db.add(log)
        await db.commit()
        
        logger.info(f"Feedback logged for item {request.id}. Correctness: {request.is_correct}")
        return {"status": "success", "item_id": request.id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error saving feedback for item {request.id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
