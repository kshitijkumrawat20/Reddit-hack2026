// API Client wrapper for communicating with the Guardian FastAPI backend.
// In Devvit, fetch is available globally, but domains must be allow-listed in devvit.json.

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

// Cleans URL to ensure it has no trailing slash
function cleanUrl(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

export async function checkContent(baseUrl: string, data: ContentSubmission): Promise<FlaggedQueueItem | null> {
  try {
    const url = `${cleanUrl(baseUrl)}/api/moderation/check`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Bypass-Tunnel-Reminder': 'true',
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

export async function getQueue(baseUrl: string, subreddit: string): Promise<FlaggedQueueItem[]> {
  try {
    const url = `${cleanUrl(baseUrl)}/api/moderation/queue?subreddit=${subreddit}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Bypass-Tunnel-Reminder': 'true',
      },
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
  baseUrl: string,
  id: string,
  action: 'approve' | 'remove' | 'ignore' | 'warn',
  moderator: string
): Promise<boolean> {
  try {
    const url = `${cleanUrl(baseUrl)}/api/moderation/resolve`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Bypass-Tunnel-Reminder': 'true',
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
  baseUrl: string,
  id: string,
  isCorrect: boolean,
  reason?: string
): Promise<boolean> {
  try {
    const url = `${cleanUrl(baseUrl)}/api/moderation/feedback`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Bypass-Tunnel-Reminder': 'true',
      },
      body: JSON.stringify({ id, is_correct: isCorrect, reason }),
    });

    return response.ok;
  } catch (error) {
    console.error('Network error submitting feedback to Guardian backend:', error);
    return false;
  }
}

export async function getAnalytics(baseUrl: string, subreddit: string): Promise<SubredditAnalytics | null> {
  try {
    const url = `${cleanUrl(baseUrl)}/api/analytics/subreddit?subreddit=${subreddit}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Bypass-Tunnel-Reminder': 'true',
      },
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
