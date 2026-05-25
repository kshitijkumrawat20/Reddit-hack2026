import json
import logging
from typing import List, Optional
from pydantic import BaseModel, Field
from config import settings

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Define Pydantic models for Gemini structured output
class ToxicityAnalysis(BaseModel):
    score: float = Field(..., description="Toxicity score between 0.0 (clean) and 1.0 (highly toxic)")
    is_toxic: bool = Field(..., description="True if content contains harassment, hate speech, severe abuse, or threats")
    reason: str = Field(..., description="A concise, one-sentence explanation of why the content is toxic, or empty if clean")

class EscalationAnalysis(BaseModel):
    score: float = Field(..., description="Flame war likelihood score between 0.0 and 1.0")
    is_escalating: bool = Field(..., description="True if the thread shows signs of rapid escalation in mutual hostility")
    reason: str = Field(..., description="Concise description of the escalation signals or mutual argument, or empty")

# Initialize client gracefully
client = None
if settings.GEMINI_API_KEY:
    try:
        from google import genai
        from google.genai import types
        client = genai.Client(api_key=settings.GEMINI_API_KEY)
        logger.info("Gemini Client successfully initialized.")
    except Exception as e:
        logger.error(f"Error initializing Gemini client: {e}")
else:
    logger.warning("GEMINI_API_KEY is not set. Running in Mock Mode.")

class GeminiService:
    @staticmethod
    async def analyze_toxicity(text: str) -> ToxicityAnalysis:
        """Analyzes text for toxicity using Gemini 1.5 Flash."""
        if not client:
            return GeminiService._mock_toxicity(text)
            
        try:
            from google.genai import types
            
            prompt = f"Analyze the following Reddit comment/post for toxic behavior, including harassment, hate speech, abusive language, or threats:\n\n{text}"
            
            # Run model call (using gemini-1.5-flash as default)
            response = client.models.generate_content(
                model='gemini-1.5-flash',
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=ToxicityAnalysis,
                    temperature=0.1
                )
            )
            
            # Parse structured JSON response
            data = json.loads(response.text)
            return ToxicityAnalysis(**data)
        except Exception as e:
            logger.error(f"Gemini toxicity analysis failed: {e}. Falling back to mock.")
            return GeminiService._mock_toxicity(text)

    @staticmethod
    async def analyze_escalation(comments: List[str]) -> EscalationAnalysis:
        """Analyzes a thread of comments to detect if a flame war is escalating."""
        if not client or not comments:
            return GeminiService._mock_escalation(comments)
            
        try:
            from google.genai import types
            
            thread_text = "\n---\n".join([f"Comment {i+1}: {c}" for i, c in enumerate(comments)])
            prompt = f"Analyze the following conversation thread. Determine if it shows signs of a rapidly escalating flame war or hostile back-and-forth personal arguments:\n\n{thread_text}"
            
            response = client.models.generate_content(
                model='gemini-1.5-flash',
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=EscalationAnalysis,
                    temperature=0.2
                )
            )
            
            data = json.loads(response.text)
            return EscalationAnalysis(**data)
        except Exception as e:
            logger.error(f"Gemini escalation analysis failed: {e}. Falling back to mock.")
            return GeminiService._mock_escalation(comments)

    @staticmethod
    async def get_embedding(text: str) -> Optional[List[float]]:
        """Generates text embedding vector using text-embedding-004 model."""
        if not client:
            return [0.0] * 768  # Return dummy embedding in mock mode
            
        try:
            # Generate embedding using the standard embedding model
            response = client.models.embed_content(
                model='text-embedding-004',
                contents=text
            )
            # Response contains a list of embeddings (usually 768 dimensions)
            return response.embeddings[0].values
        except Exception as e:
            logger.error(f"Gemini embedding failed: {e}")
            return None

    # --- MOCK FALLBACKS FOR LOCAL DEV & OFFLINE TESTING ---

    @staticmethod
    def _mock_toxicity(text: str) -> ToxicityAnalysis:
        text_lower = text.lower()
        
        # Simple keywords to trigger mock toxicity
        toxic_triggers = ["idiot", "jerk", "shut up", "hate you", "stupid", "fuck", "shitty", "die"]
        toxic_detected = any(trigger in text_lower for trigger in toxic_triggers)
        
        if toxic_detected:
            # Find which trigger matched for custom mock message
            matched = [t for t in toxic_triggers if t in text_lower][0]
            return ToxicityAnalysis(
                score=0.89,
                is_toxic=True,
                reason=f"Mock: Direct abusive content detected matching trigger '{matched}'."
            )
        
        return ToxicityAnalysis(
            score=0.08,
            is_toxic=False,
            reason=""
        )

    @staticmethod
    def _mock_escalation(comments: List[str]) -> EscalationAnalysis:
        if not comments:
            return EscalationAnalysis(score=0.0, is_escalating=False, reason="")
            
        # If there are toxic triggers in multiple comments, mock escalation
        toxic_count = 0
        toxic_triggers = ["idiot", "jerk", "shut up", "hate you", "stupid", "fuck", "shitty"]
        for c in comments:
            if any(t in c.lower() for t in toxic_triggers):
                toxic_count += 1
                
        if toxic_count >= 2:
            return EscalationAnalysis(
                score=0.91,
                is_escalating=True,
                reason=f"Mock: Escalation detected. Mutually toxic back-and-forth found ({toxic_count} toxic comments)."
            )
            
        return EscalationAnalysis(
            score=0.15,
            is_escalating=False,
            reason=""
        )
