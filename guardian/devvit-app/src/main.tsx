import { Devvit, useAsync, SettingScope } from '@devvit/public-api';
import { 
  checkContent, 
  getQueue, 
  resolveItem, 
  submitFeedback, 
  getAnalytics,
  type FlaggedQueueItem,
  type SubredditAnalytics
} from './api/backend.js';

const DEFAULT_BACKEND_URL = 'https://guardian-copilot.loca.lt';

// Configure Devvit plugins
Devvit.configure({
  redditAPI: true,
  http: true,
});

// --- SETTINGS ---

Devvit.addSettings([
  {
    type: 'string',
    name: 'backend-url',
    label: '🛡️ Guardian Backend URL',
    helpText: 'Exposed tunnel URL of the FastAPI backend (e.g. https://guardian-copilot.loca.lt)',
    defaultValue: DEFAULT_BACKEND_URL,
    scope: SettingScope.Installation,
  }
]);

// --- TRIGGERS ---

// Triggered when a new post is submitted in the subreddit
Devvit.addTrigger({
  event: 'PostSubmit',
  async onEvent(event, context) {
    const post = event.post;
    if (!post) return;

    console.log(`[Guardian] Processing new post submit: ${post.id}`);
    try {
      const baseUrl = await context.settings.get<string>('backend-url') || DEFAULT_BACKEND_URL;
      await checkContent(baseUrl, {
        id: post.id,
        type: 'post',
        subreddit: event.subreddit?.name || '',
        title: post.title,
        content: post.selftext || '',
        author: event.author?.name || 'unknown',
      });
    } catch (error) {
      console.error(`[Guardian] Error checking post ${post.id}:`, error);
    }
  },
});

// Triggered when a new comment is submitted in the subreddit
Devvit.addTrigger({
  event: 'CommentSubmit',
  async onEvent(event, context) {
    const comment = event.comment;
    if (!comment) return;

    // Prevent checking comments made by our own bot app to avoid recursion
    const currentBot = await context.reddit.getCurrentUsername();
    if (event.author?.name === currentBot) {
      console.log(`[Guardian] Skipping comment from self: ${comment.id}`);
      return;
    }

    console.log(`[Guardian] Processing new comment submit: ${comment.id}`);
    try {
      const baseUrl = await context.settings.get<string>('backend-url') || DEFAULT_BACKEND_URL;
      await checkContent(baseUrl, {
        id: comment.id,
        type: 'comment',
        subreddit: event.subreddit?.name || '',
        content: comment.body || '',
        author: event.author?.name || 'unknown',
        parent_id: comment.postId, // Map comment to its parent post ID
      });
    } catch (error) {
      console.error(`[Guardian] Error checking comment ${comment.id}:`, error);
    }
  },
});

// --- SUBREDDIT MENU ACTION ---

// Adds a moderator menu item in the subreddit to spawn the moderation feed
Devvit.addMenuItem({
  label: '🛡️ Create Guardian Feed',
  location: 'subreddit',
  forUserType: 'moderator',
  onPress: async (event, context) => {
    const subredditName = context.subredditName;
    if (!subredditName) {
      context.ui.showToast('Subreddit name not found.');
      return;
    }

    try {
      // submitPost with preview creates the custom Blocks post type
      await context.reddit.submitPost({
        title: '🛡️ Guardian AI Moderator Feed',
        subredditName: subredditName,
        preview: (
          <vstack alignment="middle center" height="100%" width="100%" backgroundColor="#0F0F10">
            <text size="large" color="#FFFFFF">Loading Guardian Moderator Feed...</text>
          </vstack>
        ),
      });
      context.ui.showToast('Guardian AI Moderation Feed created!');
    } catch (error) {
      console.error('[Guardian] Error creating custom post:', error);
      context.ui.showToast('Failed to create Guardian feed post.');
    }
  },
});

// --- CUSTOM POST TYPE (BLOCKS UI) ---

Devvit.addCustomPostType({
  name: 'GuardianFeed',
  render: (context) => {
    // 1. Tab State: 'queue' | 'analytics'
    const [activeTab, setActiveTab] = context.useState<'queue' | 'analytics'>('queue');
    // State to trigger re-fetches for useAsync
    const [reloadCounter, setReloadCounter] = context.useState<number>(0);

    // 2. Fetch viewing user moderator status
    const { data: isMod, loading: isModLoading } = useAsync(async () => {
      try {
        const username = await context.reddit.getCurrentUsername();
        if (!username) return false;
        
        const mods = await context.reddit.getModerators({
          subredditName: context.subredditName!,
          username,
        }).all();
        
        return mods.length > 0;
      } catch (error) {
        console.error('[Guardian] Mod verification error:', error);
        return false;
      }
    });

    // 3. Fetch flagged items queue
    const { data: queueData, loading: loadingQueue } = useAsync(async () => {
      try {
        const baseUrl = await context.settings.get<string>('backend-url') || DEFAULT_BACKEND_URL;
        return await getQueue(baseUrl, context.subredditName!);
      } catch (error) {
        console.error('[Guardian] Error fetching queue:', error);
        return [];
      }
    }, { depends: reloadCounter });

    // 4. Fetch insights analytics
    const { data: analyticsData, loading: loadingAnalytics } = useAsync(async () => {
      try {
        const baseUrl = await context.settings.get<string>('backend-url') || DEFAULT_BACKEND_URL;
        return await getAnalytics(baseUrl, context.subredditName!);
      } catch (error) {
        console.error('[Guardian] Error fetching analytics:', error);
        return null;
      }
    }, { depends: reloadCounter });

    const queue = (queueData || []) as FlaggedQueueItem[];
    const analytics = analyticsData as SubredditAnalytics | null;

    const triggerRefresh = () => {
      setReloadCounter((count) => count + 1);
    };

    // Action handlers
    const handleResolve = async (
      itemId: string,
      action: 'approve' | 'remove' | 'ignore' | 'warn',
      type: 'post' | 'comment'
    ) => {
      try {
        const modUsername = await context.reddit.getCurrentUsername();
        
        // Execute native Reddit moderation action
        if (action === 'approve') {
          await context.reddit.approve(itemId);
        } else if (action === 'remove') {
          // Second param is direct boolean for spam
          await context.reddit.remove(itemId, false);
        }
        
        // Get dynamic backend URL
        const baseUrl = await context.settings.get<string>('backend-url') || DEFAULT_BACKEND_URL;

        // Sync resolution to FastAPI backend
        const success = await resolveItem(baseUrl, itemId, action, modUsername || 'moderator');
        if (success) {
          context.ui.showToast(`Item resolved: ${action}d`);
          // Re-fetch dashboard states
          triggerRefresh();
        } else {
          context.ui.showToast('Resolved on Reddit, but failed to sync backend.');
          triggerRefresh();
        }
      } catch (error) {
        console.error(`[Guardian] Error resolving item ${itemId}:`, error);
        context.ui.showToast('Moderation action failed.');
      }
    };

    const handleFeedback = async (itemId: string, isCorrect: boolean) => {
      try {
        const baseUrl = await context.settings.get<string>('backend-url') || DEFAULT_BACKEND_URL;
        const success = await submitFeedback(baseUrl, itemId, isCorrect);
        if (success) {
          context.ui.showToast(isCorrect ? 'Thanks for confirming!' : 'Reported false positive.');
          triggerRefresh();
        } else {
          context.ui.showToast('Failed to submit feedback.');
        }
      } catch (error) {
        console.error(`[Guardian] Error submitting feedback for ${itemId}:`, error);
      }
    };

    // Render loading state for user permissions check
    if (isModLoading) {
      return (
        <vstack alignment="center middle" height="100%" width="100%" padding="large" backgroundColor="#0F0F10">
          <text size="large" color="#FFFFFF">Verifying credentials...</text>
        </vstack>
      );
    }

    // Access control: restrict view to moderators only
    if (!isMod) {
      return (
        <vstack alignment="center middle" height="100%" width="100%" gap="medium" padding="large" backgroundColor="#0F0F10">
          <hstack alignment="center middle" gap="small">
            <text size="xxlarge">🛡️</text>
            <text size="xlarge" weight="bold" color="#FF4500">Guardian AI active</text>
          </hstack>
          <text size="medium" color="#CCCCCC" alignment="center">
            Guardian is monitoring this community behind the scenes.
          </text>
          <text size="small" color="#888888" alignment="center">
            Access to this interactive dashboard is restricted to moderators only.
          </text>
        </vstack>
      );
    }

    // Tab Contents computed as type-safe variables to avoid complex nested JSX types
    let tabContent = <spacer />;

    if (activeTab === 'queue') {
      if (loadingQueue) {
        tabContent = (
          <vstack alignment="center middle" padding="large">
            <text color="#CCCCCC">Fetching moderation queue...</text>
          </vstack>
        );
      } else if (queue.length === 0) {
        tabContent = (
          <vstack alignment="center middle" padding="large" border="thin" borderColor="#222224" cornerRadius="medium" backgroundColor="#151516">
            <text size="xlarge">🎉</text>
            <spacer size="small" />
            <text size="medium" weight="bold" color="#4CAF50">No flagged items!</text>
            <text size="small" color="#888888" alignment="center">
              Your subreddit is clean. Guardian is standing guard.
            </text>
          </vstack>
        );
      } else {
        // Map queue items to cards
        tabContent = (
          <vstack gap="medium">
            {queue.slice(0, 3).map((item) => {
              let priorityColor = '#E53935'; // Red for High Priority
              let priorityLabel = '🚨 High Priority';
              if (item.priority === 'medium') {
                priorityColor = '#FB8C00'; // Orange
                priorityLabel = '⚠️ Medium Priority';
              } else if (item.priority === 'low') {
                priorityColor = '#FDD835'; // Yellow
                priorityLabel = '📝 Low Priority';
              }

              return (
                <vstack
                  key={item.id}
                  padding="medium"
                  border="thin"
                  borderColor={priorityColor}
                  cornerRadius="medium"
                  backgroundColor="#151516"
                  gap="small"
                >
                  {/* Priority and metadata */}
                  <hstack alignment="middle start" width="100%">
                    <hstack gap="small" alignment="middle start">
                      <text size="xsmall" weight="bold" color={priorityColor}>{priorityLabel}</text>
                      <text size="xsmall" color="#888888">| By u/{item.author}</text>
                      <text size="xsmall" color="#888888">({item.type.toUpperCase()})</text>
                    </hstack>
                    <spacer />
                    <text size="xsmall" color="#888888">
                      {new Date(item.created_at).toLocaleTimeString()}
                    </text>
                  </hstack>

                  {/* Title if post */}
                  {item.title ? (
                    <text size="medium" weight="bold" color="#FFFFFF">{item.title}</text>
                  ) : null}

                  {/* Content snippet */}
                  <text size="small" color="#DDDDDD" wrap={true}>
                    {item.content.length > 180 ? `${item.content.substring(0, 180)}...` : item.content}
                  </text>

                  {/* Flag alert badges */}
                  <hstack gap="small" alignment="middle start">
                    {item.is_toxic ? (
                      <hstack padding="xsmall" backgroundColor="#451A1D" cornerRadius="small" alignment="middle center">
                        <text size="xsmall" color="#FF8A80" weight="bold">☣️ Toxicity: {Math.round(item.toxicity_score * 100)}%</text>
                      </hstack>
                    ) : null}
                    {item.is_spam ? (
                      <hstack padding="xsmall" backgroundColor="#422D16" cornerRadius="small" alignment="middle center">
                        <text size="xsmall" color="#FFB74D" weight="bold">🚨 Spam</text>
                      </hstack>
                    ) : null}
                    {item.is_escalation ? (
                      <hstack padding="xsmall" backgroundColor="#3C1A4A" cornerRadius="small" alignment="middle center">
                        <text size="xsmall" color="#E040FB" weight="bold">🔥 Escalation</text>
                      </hstack>
                    ) : null}
                    {item.is_duplicate ? (
                      <hstack padding="xsmall" backgroundColor="#1A2D42" cornerRadius="small" alignment="middle center">
                        <text size="xsmall" color="#64B5F6" weight="bold">🔁 Duplicate</text>
                      </hstack>
                    ) : null}
                  </hstack>

                  {/* AI suggestions */}
                  <vstack padding="small" backgroundColor="#0A0A0B" cornerRadius="small">
                    <text size="xsmall" color="#CCCCCC" wrap={true}>
                      💡 Guardian Suggestion: {
                        item.toxicity_reason ||
                        item.spam_reason ||
                        item.escalation_reason ||
                        item.duplicate_reason ||
                        'Content flagged for moderator review.'
                      }
                    </text>
                  </vstack>

                  {/* Moderation Actions bar */}
                  <hstack alignment="middle start" width="100%">
                    <hstack gap="small">
                      <button
                        size="small"
                        appearance="primary"
                        onPress={() => handleResolve(item.id, 'approve', item.type)}
                      >
                        ✅ Approve
                      </button>
                      <button
                        size="small"
                        appearance="destructive"
                        onPress={() => handleResolve(item.id, 'remove', item.type)}
                      >
                        ❌ Remove
                      </button>
                      <button
                        size="small"
                        appearance="secondary"
                        onPress={() => handleResolve(item.id, 'ignore', item.type)}
                      >
                        🔇 Ignore
                      </button>
                    </hstack>
                    <spacer />
                    {/* False positive / True positive feedback */}
                    <hstack gap="small" alignment="middle end">
                      <text size="xsmall" color="#888888">Helpful?</text>
                      <button
                        size="small"
                        appearance="secondary"
                        onPress={() => handleFeedback(item.id, true)}
                      >
                        👍
                      </button>
                      <button
                        size="small"
                        appearance="secondary"
                        onPress={() => handleFeedback(item.id, false)}
                      >
                        👎
                      </button>
                    </hstack>
                  </hstack>
                </vstack>
              );
            })}
          </vstack>
        );
      }
    } else if (activeTab === 'analytics') {
      if (loadingAnalytics) {
        tabContent = (
          <vstack alignment="center middle" padding="large">
            <text color="#CCCCCC">Fetching community insights...</text>
          </vstack>
        );
      } else if (!analytics) {
        tabContent = (
          <vstack alignment="center middle" padding="large" border="thin" borderColor="#E53935" cornerRadius="medium" backgroundColor="#1A1112">
            <text size="medium" color="#FF8A80">Failed to connect to Guardian AI analytics backend.</text>
          </vstack>
        );
      } else {
        tabContent = (
          <vstack gap="medium">
            {/* Statistics counts row */}
            <hstack gap="medium" width="100%">
              <vstack padding="medium" border="thin" borderColor="#333" cornerRadius="medium" backgroundColor="#151516" width="30%" alignment="center middle">
                <text size="xlarge" color="#FF8A80" weight="bold">{analytics.total_flagged}</text>
                <text size="xsmall" color="#888888">Total Flagged</text>
              </vstack>
              <spacer size="small" />
              <vstack padding="medium" border="thin" borderColor="#333" cornerRadius="medium" backgroundColor="#151516" width="30%" alignment="center middle">
                <text size="xlarge" color="#FFB74D" weight="bold">{analytics.pending_count}</text>
                <text size="xsmall" color="#888888">Pending Queue</text>
              </vstack>
              <spacer size="small" />
              <vstack padding="medium" border="thin" borderColor="#333" cornerRadius="medium" backgroundColor="#151516" width="30%" alignment="center middle">
                <text size="xlarge" color="#81C784" weight="bold">{analytics.resolved_count}</text>
                <text size="xsmall" color="#888888">Resolved Tasks</text>
              </vstack>
            </hstack>

            {/* Violation breakdown ratios */}
            <vstack padding="medium" border="thin" borderColor="#333" cornerRadius="medium" backgroundColor="#151516" gap="small">
              <text size="medium" weight="bold" color="#FFFFFF">Community Health Ratios</text>
              <spacer size="small" />

              {/* Toxicity Ratio */}
              <vstack>
                <hstack alignment="middle start" width="100%">
                  <text size="small" color="#CCCCCC">☣️ Toxicity Rate</text>
                  <spacer />
                  <text size="small" color="#FF8A80" weight="bold">{Math.round(analytics.toxicity_rate * 100)}%</text>
                </hstack>
                <spacer size="small" />
                <hstack width="100%" height={8} backgroundColor="#333" cornerRadius="full">
                  <hstack width={`${Math.round(analytics.toxicity_rate * 100)}%`} height="100%" backgroundColor="#FF8A80" cornerRadius="full" />
                </hstack>
              </vstack>

              <spacer size="small" />

              {/* Spam Ratio */}
              <vstack>
                <hstack alignment="middle start" width="100%">
                  <text size="small" color="#CCCCCC">🚨 Spam Rate</text>
                  <spacer />
                  <text size="small" color="#FFB74D" weight="bold">{Math.round(analytics.spam_rate * 100)}%</text>
                </hstack>
                <spacer size="small" />
                <hstack width="100%" height={8} backgroundColor="#333" cornerRadius="full">
                  <hstack width={`${Math.round(analytics.spam_rate * 100)}%`} height="100%" backgroundColor="#FFB74D" cornerRadius="full" />
                </hstack>
              </vstack>

              <spacer size="small" />

              {/* Escalation Ratio */}
              <vstack>
                <hstack alignment="middle start" width="100%">
                  <text size="small" color="#CCCCCC">🔥 Escalation Rate</text>
                  <spacer />
                  <text size="small" color="#E040FB" weight="bold">{Math.round(analytics.escalation_rate * 100)}%</text>
                </hstack>
                <spacer size="small" />
                <hstack width="100%" height={8} backgroundColor="#333" cornerRadius="full">
                  <hstack width={`${Math.round(analytics.escalation_rate * 100)}%`} height="100%" backgroundColor="#E040FB" cornerRadius="full" />
                </hstack>
              </vstack>

              <spacer size="small" />

              {/* Duplicate Ratio */}
              <vstack>
                <hstack alignment="middle start" width="100%">
                  <text size="small" color="#CCCCCC">🔁 Duplicate Rate</text>
                  <spacer />
                  <text size="small" color="#64B5F6" weight="bold">{Math.round(analytics.duplicate_rate * 100)}%</text>
                </hstack>
                <spacer size="small" />
                <hstack width="100%" height={8} backgroundColor="#333" cornerRadius="full">
                  <hstack width={`${Math.round(analytics.duplicate_rate * 100)}%`} height="100%" backgroundColor="#64B5F6" cornerRadius="full" />
                </hstack>
              </vstack>
            </vstack>

            {/* Copilot accuracy rates */}
            <vstack padding="medium" border="thin" borderColor="#333" cornerRadius="medium" backgroundColor="#151516" gap="small">
              <hstack alignment="middle start" width="100%">
                <text size="medium" weight="bold" color="#FFFFFF">AI Moderator Accuracy</text>
                <spacer />
                <text size="small" color="#81C784" weight="bold">{Math.round((1 - analytics.false_positive_rate) * 100)}% Match</text>
              </hstack>
              <text size="xsmall" color="#888888">
                Accuracy calculations are computed using false positives flagged by human moderators.
              </text>
            </vstack>
          </vstack>
        );
      }
    }

    return (
      <vstack height="100%" width="100%" padding="medium" backgroundColor="#0F0F10" gap="medium">
        {/* Dashboard Title & Tabs Navigation bar */}
        <hstack alignment="middle start" width="100%" padding="small" border="thin" borderColor="#333335" cornerRadius="medium" backgroundColor="#151516">
          <hstack alignment="middle start" gap="small">
            <text size="xlarge">🛡️</text>
            <vstack>
              <text size="large" weight="bold" color="#FFFFFF">Guardian AI</text>
              <text size="xsmall" color="#888888">Community Copilot</text>
            </vstack>
          </hstack>
          <spacer />
          <hstack gap="small" alignment="middle end">
            <button
              size="small"
              appearance={activeTab === 'queue' ? 'primary' : 'secondary'}
              onPress={() => {
                setActiveTab('queue');
                triggerRefresh();
              }}
            >
              ⚠️ Queue ({queue.length})
            </button>
            <button
              size="small"
              appearance={activeTab === 'analytics' ? 'primary' : 'secondary'}
              onPress={() => {
                setActiveTab('analytics');
                triggerRefresh();
              }}
            >
              📊 Insights
            </button>
            <button
              size="small"
              appearance="secondary"
              onPress={() => {
                triggerRefresh();
                context.ui.showToast('Refreshed!');
              }}
            >
              🔄
            </button>
          </hstack>
        </hstack>

        {/* Tab Content Display */}
        {tabContent}
      </vstack>
    );
  },
});

export default Devvit;
