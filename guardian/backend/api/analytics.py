import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import select, func
from sqlmodel.ext.asyncio.session import AsyncSession

from db import get_session
from models import ModerationLog, SubredditAnalytics

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/analytics", tags=["analytics"])

@router.get("/subreddit", response_model=SubredditAnalytics)
async def get_subreddit_analytics(
    subreddit: str,
    db: AsyncSession = Depends(get_session)
):
    """Retrieves lightweight moderation analytics for a subreddit."""
    try:
        # Helper queries
        # 1. Total items processed (flagged)
        stmt_total = (
            select(func.count(ModerationLog.id))
            .where(ModerationLog.subreddit == subreddit)
        )
        total_items = (await db.execute(stmt_total)).scalar() or 0
        
        # 2. Pending queue count (currently flagged)
        stmt_pending = (
            select(func.count(ModerationLog.id))
            .where(ModerationLog.subreddit == subreddit)
            .where(ModerationLog.status == "flagged")
        )
        pending_count = (await db.execute(stmt_pending)).scalar() or 0
        
        # 3. Resolved count
        stmt_resolved = (
            select(func.count(ModerationLog.id))
            .where(ModerationLog.subreddit == subreddit)
            .where(ModerationLog.status.in_(["approved", "removed", "ignored", "warned"]))
            .where(ModerationLog.resolved_at.isnot(None))
        )
        resolved_count = (await db.execute(stmt_resolved)).scalar() or 0
        
        # 4. Toxicity count
        stmt_toxic = (
            select(func.count(ModerationLog.id))
            .where(ModerationLog.subreddit == subreddit)
            .where(ModerationLog.is_toxic == True)
        )
        toxic_count = (await db.execute(stmt_toxic)).scalar() or 0
        
        # 5. Spam count
        stmt_spam = (
            select(func.count(ModerationLog.id))
            .where(ModerationLog.subreddit == subreddit)
            .where(ModerationLog.is_spam == True)
        )
        spam_count = (await db.execute(stmt_spam)).scalar() or 0
        
        # 6. Escalation count
        stmt_escalation = (
            select(func.count(ModerationLog.id))
            .where(ModerationLog.subreddit == subreddit)
            .where(ModerationLog.is_escalation == True)
        )
        escalation_count = (await db.execute(stmt_escalation)).scalar() or 0
        
        # 7. Duplicate count
        stmt_dup = (
            select(func.count(ModerationLog.id))
            .where(ModerationLog.subreddit == subreddit)
            .where(ModerationLog.is_duplicate == True)
        )
        dup_count = (await db.execute(stmt_dup)).scalar() or 0
        
        # 8. False positive count (feedback_correct == False)
        stmt_fp = (
            select(func.count(ModerationLog.id))
            .where(ModerationLog.subreddit == subreddit)
            .where(ModerationLog.feedback_correct == False)
        )
        fp_count = (await db.execute(stmt_fp)).scalar() or 0
        
        # 9. Count of items with feedback given
        stmt_feedback_total = (
            select(func.count(ModerationLog.id))
            .where(ModerationLog.subreddit == subreddit)
            .where(ModerationLog.feedback_correct.isnot(None))
        )
        feedback_total = (await db.execute(stmt_feedback_total)).scalar() or 0
        
        # Rates calculations
        denom = total_items if total_items > 0 else 1
        toxicity_rate = toxic_count / denom
        spam_rate = spam_count / denom
        escalation_rate = escalation_count / denom
        duplicate_rate = dup_count / denom
        
        fp_denom = feedback_total if feedback_total > 0 else 1
        false_positive_rate = fp_count / fp_denom
        
        return SubredditAnalytics(
            subreddit=subreddit,
            total_flagged=total_items,
            pending_count=pending_count,
            resolved_count=resolved_count,
            toxicity_rate=round(toxicity_rate, 4),
            spam_rate=round(spam_rate, 4),
            escalation_rate=round(escalation_rate, 4),
            duplicate_rate=round(duplicate_rate, 4),
            false_positive_rate=round(false_positive_rate, 4)
        )
    except Exception as e:
        logger.error(f"Error fetching analytics for subreddit {subreddit}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
