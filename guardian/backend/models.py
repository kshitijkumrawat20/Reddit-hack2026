from datetime import datetime, timezone
from typing import Optional, List
from sqlmodel import SQLModel, Field, Column, JSON

class ModerationLog(SQLModel, table=True):
    __tablename__ = "moderation_log"
    
    id: str = Field(primary_key=True)  # Reddit ID (e.g., t3_12345 or t1_abcde)
    type: str  # "post" or "comment"
    subreddit: str
    title: Optional[str] = None  # None for comments
    content: str
    author: str
    
    # Toxicity flags
    toxicity_score: float = 0.0
    is_toxic: bool = False
    toxicity_reason: Optional[str] = None
    
    # Spam flags
    is_spam: bool = False
    spam_score: float = 0.0
    spam_reason: Optional[str] = None
    
    # Escalation flags
    is_escalation: bool = False
    escalation_score: float = 0.0
    escalation_reason: Optional[str] = None
    
    # Duplicate flags
    is_duplicate: bool = False
    duplicate_score: Optional[float] = None
    duplicate_reason: Optional[str] = None
    duplicate_of_id: Optional[str] = None
    
    # Status and priority
    status: str = Field(default="flagged")  # "flagged", "approved", "removed", "ignored", "warned"
    priority: str = Field(default="low")  # "high", "medium", "low"
    
    # Dates & logs
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    resolved_at: Optional[datetime] = None
    resolved_by: Optional[str] = None
    
    # Feedback (True = correct, False = false positive)
    feedback_correct: Optional[bool] = None
    feedback_reason: Optional[str] = None
    
    # Embeddings serialized as JSON list
    embedding_json: Optional[str] = Field(default=None, sa_column=Column(JSON))

# --- API Request/Response Schemas ---

class ContentSubmission(SQLModel):
    id: str
    type: str  # "post" or "comment"
    subreddit: str
    title: Optional[str] = None
    content: str
    author: str
    parent_id: Optional[str] = None  # For comments, the post or parent comment ID

class ResolutionRequest(SQLModel):
    id: str
    action: str  # "approve", "remove", "ignore", "warn"
    moderator: str

class FeedbackRequest(SQLModel):
    id: str
    is_correct: bool
    reason: Optional[str] = None

class QueueResponse(SQLModel):
    id: str
    type: str
    subreddit: str
    title: Optional[str] = None
    content: str
    author: str
    toxicity_score: float
    is_toxic: bool
    toxicity_reason: Optional[str]
    is_spam: bool
    spam_reason: Optional[str]
    is_escalation: bool
    escalation_reason: Optional[str]
    is_duplicate: bool
    duplicate_reason: Optional[str]
    status: str
    priority: str
    created_at: datetime

class SubredditAnalytics(SQLModel):
    subreddit: str
    total_flagged: int
    pending_count: int
    resolved_count: int
    toxicity_rate: float
    spam_rate: float
    escalation_rate: float
    duplicate_rate: float
    false_positive_rate: float
