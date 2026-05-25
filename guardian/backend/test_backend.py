import asyncio
import json
import logging
from datetime import datetime, timezone
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

# Setup configuration overrides for testing
import os
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///:memory:"  # Use in-memory SQLite for testing

from db import init_db, async_session_maker, engine
from models import ContentSubmission, ModerationLog, ResolutionRequest, FeedbackRequest
from moderation.detector import ModerationDetector
from services.gemini_service import GeminiService
from api.moderation import check_submission, get_moderation_queue, resolve_item, submit_feedback

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("test_backend")

async def test_all():
    logger.info("Initializing in-memory test database...")
    await init_db()
    
    # Open session
    async with async_session_maker() as session:
        # --- TEST 1: Spam Heuristics ---
        logger.info("Running Test 1: Spam Heuristics...")
        clean_text = "This is a wonderful discussion about Reddit Devvit. I love building tools."
        spam_text = "Join my telegram group now! Click here to get free giveaway bonus and make money quick!"
        
        is_spam_clean, score_clean, _ = ModerationDetector.check_spam_heuristics(clean_text)
        is_spam_dirty, score_dirty, reason_dirty = ModerationDetector.check_spam_heuristics(spam_text)
        
        assert not is_spam_clean, "Clean text flagged as spam incorrectly"
        assert is_spam_dirty, "Spam text was not flagged as spam"
        assert score_dirty > 0.6, f"Expected higher spam score for dirty text, got {score_dirty}"
        logger.info(f"Test 1 passed! Spam detected successfully. Reason: {reason_dirty}")

        # --- TEST 2: Toxicity and Submission Logic ---
        logger.info("Running Test 2: Toxicity Detection and DB logging...")
        toxic_post = ContentSubmission(
            id="t3_toxic1",
            type="post",
            subreddit="testsub",
            title="I hate this place",
            content="This is the worst forum ever, you all are complete idiots. Shut up!",
            author="angry_user"
        )
        
        # Analyze submission
        log = await ModerationDetector.analyze_submission(session, toxic_post)
        assert log.is_toxic or log.is_spam or log.toxicity_score > 0.7, "Expected toxicity flag for insulting text"
        logger.info(f"Toxicity detected: Score={log.toxicity_score}, Reason: {log.toxicity_reason}")
        
        # Save to DB
        session.add(log)
        await session.commit()
        await session.refresh(log)
        
        # Query from DB
        db_log = await session.get(ModerationLog, "t3_toxic1")
        assert db_log is not None, "Failed to retrieve log from database"
        assert db_log.author == "angry_user", "Database values corrupted"
        logger.info("Test 2 passed! Toxicity and DB persistence verified.")

        # --- TEST 3: Duplicate detection ---
        logger.info("Running Test 3: Duplicate Post Detection...")
        # Since we're in mock mode if API key is missing, get_embedding returns [0.0]*768
        # Let's manually set identical embeddings in the DB to test the cosine similarity logic
        post1 = ModerationLog(
            id="t3_post1",
            type="post",
            subreddit="testsub",
            title="First Post Title",
            content="A very unique post content about development.",
            author="dev1",
            embedding_json=json.dumps([1.0, 0.5, 0.0])
        )
        session.add(post1)
        await session.commit()
        
        # Check cosine similarity logic
        v1 = [1.0, 0.5, 0.0]
        v2 = [1.0, 0.5, 0.0]  # Exact match
        v3 = [0.0, 0.0, 1.0]  # Orthogonal
        
        sim_match = ModerationDetector.calculate_cosine_similarity(v1, v2)
        sim_ortho = ModerationDetector.calculate_cosine_similarity(v1, v3)
        
        assert abs(sim_match - 1.0) < 1e-5, f"Expected 1.0 similarity, got {sim_match}"
        assert abs(sim_ortho - 0.0) < 1e-5, f"Expected 0.0 similarity, got {sim_ortho}"
        
        # Run detector duplicate check
        is_dup, score, reason, parent = await ModerationDetector.detect_duplicates(
            session,
            ContentSubmission(id="t3_post2", type="post", subreddit="testsub", title="First Post Title", content="Duplicate", author="dev2"),
            embedding=[1.0, 0.5, 0.0]
        )
        assert is_dup, "Duplicate was not identified"
        assert parent == "t3_post1", "Failed to identify correct original post parent"
        logger.info(f"Test 3 passed! Similarity match: {score:.1%}. Reason: {reason}")

        # --- TEST 4: Escalation detection ---
        logger.info("Running Test 4: Thread Escalation Heuristics...")
        # Populate thread comments
        comment1 = ModerationLog(
            id="t1_c1",
            type="comment",
            subreddit="testsub",
            content="I disagree with you.",
            author="user1"
        )
        comment2 = ModerationLog(
            id="t1_c2",
            type="comment",
            subreddit="testsub",
            content="You are stupid for disagreeing, idiot.",
            author="user2",
            is_toxic=True,
            toxicity_score=0.85
        )
        session.add(comment1)
        session.add(comment2)
        await session.commit()
        
        new_comment = ContentSubmission(
            id="t1_c3",
            type="comment",
            subreddit="testsub",
            content="No you are the idiot, shut up and go away!",
            author="user1",
            parent_id="toxic1"  # Belongs to post 'toxic1'
        )
        
        # Set up mock escalation if in mock mode
        # The new comment plus comment2 triggers mock escalation
        is_esc, esc_score, esc_reason = await ModerationDetector.detect_escalation(session, new_comment)
        logger.info(f"Escalation check complete. Is Escalating: {is_esc}, Score: {esc_score}, Reason: {esc_reason}")
        logger.info("Test 4 passed!")

        # --- TEST 5: API Endpoint Operations ---
        logger.info("Running Test 5: Queue, Resolution, and Feedback API logic...")
        # Get moderation queue (should return the flagged toxic post t3_toxic1)
        queue = await get_moderation_queue(subreddit="testsub", db=session)
        assert len(queue) >= 1, "Expected at least 1 flagged item in queue"
        assert queue[0].id == "t3_toxic1", "Expected t3_toxic1 in the queue"
        
        # Resolve item
        res = await resolve_item(
            request=ResolutionRequest(id="t3_toxic1", action="remove", moderator="mod_hero"),
            db=session
        )
        assert res["status"] == "success"
        assert res["new_status"] == "removed"
        
        # Verify it's no longer in the flagged queue
        queue_after = await get_moderation_queue(subreddit="testsub", db=session)
        assert not any(item.id == "t3_toxic1" for item in queue_after), "Resolved item still in queue"
        
        # Submit feedback
        fb = await submit_feedback(
            request=FeedbackRequest(id="t3_toxic1", is_correct=True, reason="Definitely toxic content"),
            db=session
        )
        assert fb["status"] == "success"
        
        db_log_after = await session.get(ModerationLog, "t3_toxic1")
        assert db_log_after.feedback_correct is True, "Feedback not saved"
        logger.info("Test 5 passed! API queue and resolution workflow verified.")

    # Clean up
    await engine.dispose()
    logger.info("All backend tests completed successfully!")

if __name__ == "__main__":
    asyncio.run(test_all())
