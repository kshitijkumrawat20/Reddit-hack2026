import json
import re
import logging
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Tuple
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from config import settings
from models import ModerationLog, ContentSubmission
from services.gemini_service import GeminiService

logger = logging.getLogger(__name__)

# Heuristic spam keywords/regexes
SPAM_KEYWORDS = [
    r"buy cheap", r"make money quick", r"telegram group", r"whatsapp link",
    r"click here to get", r"join my channel", r"sign up bonus", r"get rich",
    r"crypto investment", r"whatsapp \+\d+", r"free giveaway", r"make \$[0-9]+ daily",
    r"cash app transfer", r"onlyfans discount", r"dm me for", r"passive income"
]

class ModerationDetector:
    @staticmethod
    def calculate_cosine_similarity(v1: List[float], v2: List[float]) -> float:
        """Calculates cosine similarity between two float vectors in pure Python."""
        if not v1 or not v2 or len(v1) != len(v2):
            return 0.0
        dot_product = sum(a * b for a, b in zip(v1, v2))
        norm_a = sum(a * a for a in v1) ** 0.5
        norm_b = sum(b * b for b in v2) ** 0.5
        if norm_a == 0.0 or norm_b == 0.0:
            return 0.0
        return dot_product / (norm_a * norm_b)

    @staticmethod
    def check_spam_heuristics(text: str) -> Tuple[bool, float, str]:
        """Detects spam using heuristics (regex and keyword matching)."""
        text_lower = text.lower()
        matched_keywords = []
        
        # Check against patterns
        for pattern in SPAM_KEYWORDS:
            if re.search(pattern, text_lower):
                matched_keywords.append(pattern)
                
        # Count url patterns
        urls = re.findall(r"https?://[^\s]+", text_lower)
        
        # Scoring logic
        spam_score = 0.0
        reasons = []
        
        if len(matched_keywords) > 0:
            spam_score += 0.5 + (0.1 * len(matched_keywords))
            reasons.append(f"Contains promotional keywords matching patterns: {matched_keywords}")
            
        if len(urls) > 2:
            spam_score += 0.2 + (0.05 * len(urls))
            reasons.append(f"Contains excessive URL links ({len(urls)})")
            
        # Check repetitiveness
        words = text_lower.split()
        if len(words) > 10:
            unique_words = set(words)
            lexical_diversity = len(unique_words) / len(words)
            if lexical_diversity < 0.4:
                spam_score += 0.3
                reasons.append("Very low lexical diversity (highly repetitive phrasing)")
                
        spam_score = min(spam_score, 1.0)
        is_spam = spam_score >= settings.SPAM_THRESHOLD
        
        reason_str = "; ".join(reasons) if reasons else ""
        return is_spam, spam_score, reason_str

    @staticmethod
    async def detect_escalation(
        db: AsyncSession,
        submission: ContentSubmission
    ) -> Tuple[bool, float, str]:
        """Detects thread escalation for comments by analyzing recent comments in the same thread."""
        if submission.type != "comment" or not submission.parent_id:
            return False, 0.0, ""
            
        # Get last 5 comments in the same post/thread from our database
        stmt = (
            select(ModerationLog)
            .where(ModerationLog.type == "comment")
            .where(ModerationLog.id != submission.id)
            .where(ModerationLog.subreddit == submission.subreddit)
            # parent_id in ContentSubmission stores the post ID for thread tracking
            .where(ModerationLog.id.like(f"%{submission.parent_id}%") | (submission.parent_id in submission.id))
            .order_by(ModerationLog.created_at.desc())
            .limit(5)
        )
        
        result = await db.execute(stmt)
        recent_comments = result.scalars().all()
        
        if len(recent_comments) < 2:
            # Not enough conversation history in the database to detect escalation yet
            return False, 0.0, ""
            
        # Extract comment texts for Gemini to analyze
        # Include the current comment as the last one
        comment_texts = [log.content for log in reversed(recent_comments)] + [submission.content]
        
        escalation_result = await GeminiService.analyze_escalation(comment_texts)
        return (
            escalation_result.is_escalating,
            escalation_result.score,
            escalation_result.reason
        )

    @staticmethod
    async def detect_duplicates(
        db: AsyncSession,
        submission: ContentSubmission,
        embedding: List[float]
    ) -> Tuple[bool, float, str, Optional[str]]:
        """Checks for duplicate posts in the subreddit using cosine similarity of embeddings."""
        if submission.type != "post" or not embedding or all(val == 0.0 for val in embedding):
            return False, 0.0, "", None
            
        # Look back threshold days (default 30 days)
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=settings.DUPLICATE_CHECK_DAYS)
        
        # Query recently stored posts in the same subreddit
        stmt = (
            select(ModerationLog)
            .where(ModerationLog.type == "post")
            .where(ModerationLog.id != submission.id)
            .where(ModerationLog.subreddit == submission.subreddit)
            .where(ModerationLog.created_at >= cutoff_date)
            .where(ModerationLog.embedding_json.isnot(None))
        )
        
        result = await db.execute(stmt)
        recent_posts = result.scalars().all()
        
        best_similarity = 0.0
        duplicate_of_log: Optional[ModerationLog] = None
        
        for post in recent_posts:
            try:
                post_vector = json.loads(post.embedding_json)
                similarity = ModerationDetector.calculate_cosine_similarity(embedding, post_vector)
                if similarity > best_similarity:
                    best_similarity = similarity
                    duplicate_of_log = post
            except Exception as e:
                logger.error(f"Error parsing embedding for post {post.id}: {e}")
                continue
                
        is_duplicate = best_similarity >= settings.DUPLICATE_THRESHOLD
        
        if is_duplicate and duplicate_of_log:
            reason = f"Duplicate of post '{duplicate_of_log.title}' (Similarity: {best_similarity:.1%})"
            return True, best_similarity, reason, duplicate_of_log.id
            
        return False, best_similarity, "", None

    @classmethod
    async def analyze_submission(
        cls,
        db: AsyncSession,
        submission: ContentSubmission
    ) -> ModerationLog:
        """Runs the full suite of toxicity, spam, escalation, and duplicate checks on a submission."""
        
        # 1. Toxicity Check (Gemini)
        # Check either title + content (for posts) or content (for comments)
        text_to_check = submission.content
        if submission.type == "post" and submission.title:
            text_to_check = f"{submission.title}\n\n{submission.content}"
            
        toxicity_result = await GeminiService.analyze_toxicity(text_to_check)
        
        # 2. Spam Check (Heuristics)
        is_spam, spam_score, spam_reason = cls.check_spam_heuristics(text_to_check)
        
        # 3. Escalation Check (Gemini, if comment)
        is_escalation, escalation_score, escalation_reason = await cls.detect_escalation(db, submission)
        
        # 4. Generate Embedding & Duplicate Check (if post)
        embedding = None
        is_duplicate = False
        duplicate_score = 0.0
        duplicate_reason = ""
        duplicate_of_id = None
        
        if submission.type == "post":
            # Generate embedding
            embedding = await GeminiService.get_embedding(text_to_check)
            if embedding:
                is_duplicate, duplicate_score, duplicate_reason, duplicate_of_id = await cls.detect_duplicates(
                    db, submission, embedding
                )
        
        # Determine Priority Level
        # high: severe toxicity, flame war escalation, or spam with high toxicity
        # medium: standard toxicity, spam, or escalation
        # low: clean, duplicates, or mild warnings
        priority = "low"
        if toxicity_result.score >= 0.90 or (toxicity_result.is_toxic and is_escalation) or (is_spam and toxicity_result.score >= 0.50):
            priority = "high"
        elif toxicity_result.is_toxic or is_spam or is_escalation:
            priority = "medium"
            
        # Determine initial status
        # If any violation detected, status is "flagged", otherwise "approved" (i.e. auto-passed by Guardian)
        is_flagged = toxicity_result.is_toxic or is_spam or is_escalation or is_duplicate
        status = "flagged" if is_flagged else "approved"
        
        # Create ModerationLog entity
        log = ModerationLog(
            id=submission.id,
            type=submission.type,
            subreddit=submission.subreddit,
            title=submission.title,
            content=submission.content,
            author=submission.author,
            
            # Toxicity
            toxicity_score=toxicity_result.score,
            is_toxic=toxicity_result.is_toxic,
            toxicity_reason=toxicity_result.reason,
            
            # Spam
            is_spam=is_spam,
            spam_score=spam_score,
            spam_reason=spam_reason,
            
            # Escalation
            is_escalation=is_escalation,
            escalation_score=escalation_score,
            escalation_reason=escalation_reason,
            
            # Duplicate
            is_duplicate=is_duplicate,
            duplicate_score=duplicate_score if is_duplicate else None,
            duplicate_reason=duplicate_reason if is_duplicate else None,
            duplicate_of_id=duplicate_of_id,
            
            # Queue parameters
            status=status,
            priority=priority,
            
            # Embedding
            embedding_json=json.dumps(embedding) if embedding else None
        )
        
        return log
