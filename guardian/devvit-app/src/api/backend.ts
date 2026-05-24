// API Client wrapper for communicating with the Guardian FastAPI backend.
// In Devvit, fetch is available globally, but domains must be allow-listed in devvit.json.

const BACKEND_URL = 'http://localhost:8000';

export type ContentSubmission = {
  id: string;
  type: 'post' | 'comment';
  subreddit: string;
  title?: string;
  content: string;
  author: string;
  parent_id?: string;
  [key: string]: any;
};

export type FlaggedQueueItem = {
  id: string;
  type: 'post' | 'comment';
  subreddit: string;
  title?: string;
  content: string;
  author: string;
  toxicity_score: number;
  is_toxic: boolean;
  toxicity_reason?: string;
  is_spam: boolean;
  spam_reason?: string;
  is_escalation: boolean;
  escalation_reason?: string;
  is_duplicate: boolean;
  duplicate_reason?: string;
  status: string;
  priority: 'high' | 'medium' | 'low';
  created_at: string;
  [key: string]: any;
};

export type SubredditAnalytics = {
  subreddit: string;
  total_flagged: number;
  pending_count: number;
  resolved_count: number;
  toxicity_rate: number;
  spam_rate: number;
  escalation_rate: number;
  duplicate_rate: number;
  false_positive_rate: number;
  [key: string]: any;
};

export async function checkContent(data: ContentSubmission): Promise<FlaggedQueueItem | null> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/moderation/check`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      console.error(`Backend error checking content: ${response.statusText}`);
      return null;
    }

    return (await response.json()) as FlaggedQueueItem;
  } catch (error) {
    console.error('Network error checking content with Guardian backend:', error);
    return null;
  }
}

export async function getQueue(subreddit: string): Promise<FlaggedQueueItem[]> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/moderation/queue?subreddit=${subreddit}`, {
      method: 'GET',
    });

    if (!response.ok) {
      console.error(`Backend error fetching queue: ${response.statusText}`);
      return [];
    }

    return (await response.json()) as FlaggedQueueItem[];
  } catch (error) {
    console.error('Network error fetching queue from Guardian backend:', error);
    return [];
  }
}

export async function resolveItem(
  id: string,
  action: 'approve' | 'remove' | 'ignore' | 'warn',
  moderator: string
): Promise<boolean> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/moderation/resolve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ id, action, moderator }),
    });

    return response.ok;
  } catch (error) {
    console.error('Network error resolving item with Guardian backend:', error);
    return false;
  }
}

export async function submitFeedback(
  id: string,
  isCorrect: boolean,
  reason?: string
): Promise<boolean> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/moderation/feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ id, is_correct: isCorrect, reason }),
    });

    return response.ok;
  } catch (error) {
    console.error('Network error submitting feedback to Guardian backend:', error);
    return false;
  }
}

export async function getAnalytics(subreddit: string): Promise<SubredditAnalytics | null> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/analytics/subreddit?subreddit=${subreddit}`, {
      method: 'GET',
    });

    if (!response.ok) {
      console.error(`Backend error fetching analytics: ${response.statusText}`);
      return null;
    }

    return (await response.json()) as SubredditAnalytics;
  } catch (error) {
    console.error('Network error fetching analytics from Guardian backend:', error);
    return null;
  }
}
