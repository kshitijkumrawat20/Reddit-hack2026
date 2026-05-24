# 🛡️ Guardian — AI Moderator Copilot for Reddit Communities

> An AI-powered Moderator Copilot for Reddit communities that helps moderators reduce workload using explainable AI moderation suggestions, escalation detection, and smart moderation workflows integrated directly into Reddit.

---

## 📌 Problem: Moderator Overload & Fatigue
Reddit moderators handle thousands of submissions and comments daily. This manual moderation is:
1. **Time-consuming**: Sorting through reports, queues, and comments is a major bottleneck.
2. **Mentally taxing**: Exposure to harassment, abuse, and hate speech causes significant fatigue.
3. **Reactive, not proactive**: Flame wars, spam waves, and toxic escalations are often caught only *after* they have disrupted the community.

## 💡 Solution: Guardian AI Copilot
Guardian acts as an **intelligent assistant living inside Reddit**. Instead of replacing human oversight, Guardian assists moderators by prioritizing issues, explaining its reasoning, and handling the heavy lifting of toxicity, spam, escalation, and duplicate checks.

*   **Moderators remain in control**: Every action requires moderator validation.
*   **Reddit-native feel**: Built on Reddit Devvit, Guardian fits inline with current moderation workflows.
*   **Explainable AI**: Suggests actions *and* explains why (e.g., pointing out rule violations).

---

## ⚙️ Core Architecture

```text
    Reddit Subreddit (Post / Comment Submitted)
                       │
                       ▼
            [Devvit Event Trigger]
                       │
            (HTTP POST /check API)
                       │
                       ▼
             [FastAPI AI Backend]
                       │
     ┌─────────────────┴─────────────────┐
     ▼                                   ▼
 [AI Analysis Services]         [Local SQLite DB]
  ├── Toxicity (Gemini)          └── Moderation Logs & Queue
  ├── Spam (Regex/Heuristics)
  ├── Escalation (Gemini)
  └── Duplicates (Gemini Embeddings)
                       │
                       ▼
      [Interactive Custom Post UI (Blocks)]
   (Approve / Remove / Ignore / Submit Feedback)
```

---

## 🌟 Key Features

### 1. Guardian AI Moderation Feed
The primary interface is a custom, interactive Reddit post powered by Devvit Blocks. When loaded by a moderator, it renders the prioritized moderation queue. When loaded by standard users, it displays a secure protection-active screen.

### 2. Explainable Toxicity Detection
Guardian checks content against hate speech, harassment, severe insults, and threats using the `gemini-1.5-flash` model. It displays a toxicity percentage alongside a clear explanation of *why* it was flagged.

### 3. Smart Spam Heuristics
Flags promotional posts, spam links, formatting abnormalities, and bot-like repetitive messaging using regex patterns and lexical diversity heuristics.

### 4. Flame War Escalation Detection (Killer Feature)
When a comment is flagged, Guardian checks the thread's recent comment history. If it detects a rapidly rising wave of toxicity or mutual bickering, it flags the thread for immediate review.

### 5. Repost & Duplicate Detection
Using Gemini `text-embedding-004` vector representations, Guardian performs a cosine similarity check against recent posts in the subreddit to find duplicates.

### 6. Human-in-the-Loop Actions
Moderators can click **Approve** or **Remove** directly within the card, immediately updating Reddit and the backend. It also supports **Ignore** and **Accuracy Feedback** (thumbs up/down) to log false positive metrics for the AI models.

### 7. Community Health Insights
A visual tab inside the Devvit app showing stats: total processed items, resolved tasks, and graphical progress bars indicating ratios of toxicity, spam, escalation, and duplicates in the subreddit.

---

## 📁 Folder Structure

```text
guardian/
│
├── backend/                  # FastAPI Python backend
│   ├── api/                  # Moderation & analytics endpoints
│   ├── moderation/           # Analysis orchestrator and heuristics
│   ├── services/             # Gemini API client wrapper
│   ├── models.py             # SQLModel DB models
│   ├── db.py                 # Async SQLite connection setup
│   ├── config.py             # Settings and .env config loader
│   ├── test_backend.py       # Async test suite
│   └── .venv/                # Python virtual environment
│
├── devvit-app/               # TypeScript Reddit Devvit app
│   ├── src/
│   │   ├── api/              # HTTP client wrapper
│   │   └── main.tsx          # Triggers, menu actions, and Blocks UI
│   ├── devvit.json           # Manifest
│   ├── package.json          # npm dependencies
│   └── tsconfig.json         # TS compiler settings
│
└── README.md                 # Project documentation
```

---

## 🚀 Setup & Installation

### Prerequisites
- **Python**: 3.10+
- **Node.js**: v20+
- **Reddit Account**: A Reddit account with developer app creation permissions.
- **Gemini API Key**: An API key from Google AI Studio.

### 1. Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd guardian/backend
   ```
2. Create and configure the environment variables:
   Create a `.env` file inside `guardian/backend/` and add:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   DATABASE_URL=sqlite+aiosqlite:///./guardian.db
   HOST=127.0.0.1
   PORT=8000
   ```
3. Install dependencies and start the backend:
   We recommend using `uv` for speed:
   ```bash
   uv pip install -r requirements.txt # (or let uv detect and install)
   uvicorn main:app --host 127.0.0.1 --port 8000 --reload
   ```
4. Verify the backend:
   Open `http://127.0.0.1:8000/` in your browser. You should see `{"status": "online"}`.

### 2. Devvit App Setup
1. Navigate to the Devvit app directory:
   ```bash
   cd guardian/devvit-app
   ```
2. Install npm dependencies:
   ```bash
   npm install
   ```
3. Log in to your Reddit account on the Devvit CLI:
   ```bash
   npx devvit login
   ```
4. Start playtesting (deploys app to your test subreddit):
   ```bash
   npm run dev
   ```

### 3. Deploying Guardian inside Reddit
1. Navigate to your test subreddit on Reddit (web or mobile).
2. Open the Subreddit options or Moderator Tools.
3. Click the menu option: **🛡️ Create Guardian Feed**.
4. A custom post will be submitted. Click on it to open the interactive **Guardian Moderator Feed**!
5. Try posting normal and flagged comments (e.g. containing promotional keywords or abusive terms) to watch the queue update in real-time.
