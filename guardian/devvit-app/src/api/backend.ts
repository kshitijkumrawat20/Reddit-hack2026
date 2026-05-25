// API Client wrapper for communicating with the Guardian FastAPI backend.
// In Devvit, fetch is available globally, but domains must be allow-listed in devvit.json.
// Fallback logic uses Devvit's built-in Redis storage when backend connection is unavailable.

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
  spam_score?: number;
  spam_reason?: string;
  is_escalation: boolean;
  escalation_score?: number;
  escalation_reason?: string;
  is_duplicate: boolean;
  duplicate_score?: number;
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

type RedisClient = {
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string): Promise<string>;
};

// Cleans URL to ensure it has no trailing slash
function cleanUrl(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

// --- Local Redis Fallback Helpers ---

async function getQueueFromRedis(redis: RedisClient, subreddit: string): Promise<FlaggedQueueItem[]> {
  try {
    const raw = await redis.get(`guardian:queue:${subreddit}`);
    if (raw) {
      return JSON.parse(raw) as FlaggedQueueItem[];
    }
  } catch (e) {
    console.error('Redis error getting queue:', e);
  }
  return [];
}

async function saveQueueToRedis(redis: RedisClient, subreddit: string, queue: FlaggedQueueItem[]): Promise<void> {
  try {
    await redis.set(`guardian:queue:${subreddit}`, JSON.stringify(queue));
  } catch (e) {
    console.error('Redis error saving queue:', e);
  }
}

async function getAnalyticsFromRedis(redis: RedisClient, subreddit: string): Promise<SubredditAnalytics> {
  try {
    const raw = await redis.get(`guardian:analytics:${subreddit}`);
    if (raw) {
      return JSON.parse(raw) as SubredditAnalytics;
    }
  } catch (e) {
    console.error('Redis error getting analytics:', e);
  }
  return {
    subreddit,
    total_flagged: 0,
    pending_count: 0,
    resolved_count: 0,
    toxicity_rate: 0.0,
    spam_rate: 0.0,
    escalation_rate: 0.0,
    duplicate_rate: 0.0,
    false_positive_rate: 0.0,
  };
}

async function saveAnalyticsToRedis(redis: RedisClient, subreddit: string, analytics: SubredditAnalytics): Promise<void> {
  try {
    await redis.set(`guardian:analytics:${subreddit}`, JSON.stringify(analytics));
  } catch (e) {
    console.error('Redis error saving analytics:', e);
  }
}

// Local mock analyzer to detect toxicity and spam keywords during offline dev
function localCheckContent(data: ContentSubmission): FlaggedQueueItem | null {
  const contentLower = ((data.title || '') + ' ' + data.content).toLowerCase();
  
  // Toxicity triggers
  const toxicKeywords = ["idiot", "jerk", "shut up", "hate you", "stupid", "fuck", "shitty", "die", "garbage", "loser"];
  const matchedToxic = toxicKeywords.find(word => contentLower.includes(word));
  
  // Spam triggers
  const spamKeywords = ["telegram", "make money quick", "free giveaway", "click here", "join group", "whatsapp", "crypto earn"];
  const matchedSpam = spamKeywords.find(word => contentLower.includes(word));
  
  // Duplicate mock trigger
  const isDuplicateMock = contentLower.includes("double post") || contentLower.includes("test duplicate");
  
  // Escalation mock trigger
  const isEscalationMock = contentLower.includes("flame war") || contentLower.includes("drama thread");
  
  const isToxic = !!matchedToxic;
  const isSpam = !!matchedSpam;
  const isDuplicate = isDuplicateMock;
  const isEscalation = isEscalationMock;
  
  if (isToxic || isSpam || isDuplicate || isEscalation) {
    return {
      id: data.id,
      type: data.type,
      subreddit: data.subreddit,
      title: data.title,
      content: data.content,
      author: data.author,
      toxicity_score: isToxic ? 0.85 : 0.05,
      is_toxic: isToxic,
      toxicity_reason: isToxic ? `Local Match: Found abusive word '${matchedToxic}'` : undefined,
      is_spam: isSpam,
      spam_score: isSpam ? 0.90 : 0.05,
      spam_reason: isSpam ? `Local Match: Found spam promotional phrase '${matchedSpam}'` : undefined,
      is_escalation: isEscalation,
      escalation_score: isEscalation ? 0.88 : 0.05,
      escalation_reason: isEscalation ? "Local Match: Flagged thread escalation pattern" : undefined,
      is_duplicate: isDuplicate,
      duplicate_score: isDuplicate ? 0.95 : 0.05,
      duplicate_reason: isDuplicate ? "Local Match: High similarity duplicate detected" : undefined,
      status: 'flagged',
      priority: (isToxic || isEscalation) ? 'high' : (isSpam ? 'medium' : 'low'),
      created_at: new Date().toISOString(),
    };
  }
  
  return null;
}

// --- API Client Interfaces ---

export async function checkContent(
  baseUrl: string,
  data: ContentSubmission,
  redis?: RedisClient
): Promise<FlaggedQueueItem | null> {
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
      throw new Error(`HTTP Error ${response.status}`);
    }

    return (await response.json()) as FlaggedQueueItem;
  } catch (error) {
    console.error('Network error checking content with Guardian backend, falling back to local Redis DB:', error);
    if (!redis) return null;
    
    // Evaluate content using local regex matcher
    const flaggedItem = localCheckContent(data);
    if (flaggedItem) {
      const queue = await getQueueFromRedis(redis, data.subreddit);
      // Avoid duplicate adds
      if (!queue.some(item => item.id === flaggedItem.id)) {
        queue.push(flaggedItem);
        await saveQueueToRedis(redis, data.subreddit, queue);
      }
      
      // Update local analytics counters
      const analytics = await getAnalyticsFromRedis(redis, data.subreddit);
      analytics.total_flagged += 1;
      analytics.pending_count += 1;
      if (flaggedItem.is_toxic) analytics.toxicity_rate = (analytics.toxicity_rate * (analytics.total_flagged - 1) + 1) / analytics.total_flagged;
      if (flaggedItem.is_spam) analytics.spam_rate = (analytics.spam_rate * (analytics.total_flagged - 1) + 1) / analytics.total_flagged;
      if (flaggedItem.is_escalation) analytics.escalation_rate = (analytics.escalation_rate * (analytics.total_flagged - 1) + 1) / analytics.total_flagged;
      if (flaggedItem.is_duplicate) analytics.duplicate_rate = (analytics.duplicate_rate * (analytics.total_flagged - 1) + 1) / analytics.total_flagged;
      
      // Format decimals
      analytics.toxicity_rate = Math.round(analytics.toxicity_rate * 10000) / 10000;
      analytics.spam_rate = Math.round(analytics.spam_rate * 10000) / 10000;
      analytics.escalation_rate = Math.round(analytics.escalation_rate * 10000) / 10000;
      analytics.duplicate_rate = Math.round(analytics.duplicate_rate * 10000) / 10000;
      
      await saveAnalyticsToRedis(redis, data.subreddit, analytics);
      return flaggedItem;
    }
    return null;
  }
}

export async function getQueue(
  baseUrl: string, 
  subreddit: string,
  redis?: RedisClient
): Promise<FlaggedQueueItem[]> {
  try {
    const url = `${cleanUrl(baseUrl)}/api/moderation/queue?subreddit=${subreddit}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Bypass-Tunnel-Reminder': 'true',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP Error ${response.status}`);
    }

    return (await response.json()) as FlaggedQueueItem[];
  } catch (error) {
    console.error('Network error fetching queue from Guardian backend, falling back to local Redis DB:', error);
    if (!redis) return [];
    
    const items = await getQueueFromRedis(redis, subreddit);
    
    // Sort priority desc, then date desc
    const priorityMap = { high: 3, medium: 2, low: 1 };
    return items.sort((a, b) => {
      const aVal = priorityMap[a.priority] || 0;
      const bVal = priorityMap[b.priority] || 0;
      if (aVal !== bVal) return bVal - aVal;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }
}

export async function resolveItem(
  baseUrl: string,
  id: string,
  action: 'approve' | 'remove' | 'ignore' | 'warn',
  moderator: string,
  subreddit?: string,
  redis?: RedisClient
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
    console.error('Network error resolving item with Guardian backend, falling back to local Redis DB:', error);
    if (subreddit && redis) {
      let queue = await getQueueFromRedis(redis, subreddit);
      const idx = queue.findIndex(item => item.id === id);
      if (idx > -1) {
        queue.splice(idx, 1);
        await saveQueueToRedis(redis, subreddit, queue);
        
        const analytics = await getAnalyticsFromRedis(redis, subreddit);
        analytics.pending_count = Math.max(0, analytics.pending_count - 1);
        analytics.resolved_count += 1;
        await saveAnalyticsToRedis(redis, subreddit, analytics);
        return true;
      }
    }
    return false;
  }
}

export async function submitFeedback(
  baseUrl: string,
  id: string,
  isCorrect: boolean,
  reason?: string,
  subreddit?: string,
  redis?: RedisClient
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
    console.error('Network error submitting feedback to Guardian backend, falling back to local Redis DB:', error);
    if (subreddit && redis) {
      const analytics = await getAnalyticsFromRedis(redis, subreddit);
      const totalFeedback = analytics.resolved_count || 1;
      const fpCount = !isCorrect ? 1 : 0;
      analytics.false_positive_rate = Math.round((fpCount / totalFeedback) * 10000) / 10000;
      await saveAnalyticsToRedis(redis, subreddit, analytics);
      return true;
    }
    return false;
  }
}

export async function getAnalytics(
  baseUrl: string, 
  subreddit: string,
  redis?: RedisClient
): Promise<SubredditAnalytics | null> {
  try {
    const url = `${cleanUrl(baseUrl)}/api/analytics/subreddit?subreddit=${subreddit}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Bypass-Tunnel-Reminder': 'true',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP Error ${response.status}`);
    }

    return (await response.json()) as SubredditAnalytics;
  } catch (error) {
    console.error('Network error fetching analytics from Guardian backend, falling back to local Redis DB:', error);
    if (!redis) return null;
    return await getAnalyticsFromRedis(redis, subreddit);
  }
}
