# Guardian AI Moderator Copilot — Devvit App

Guardian is an AI-powered moderator copilot for Reddit. It automatically flags toxicity, spam, flame-wars, and duplicates, displaying them in a native moderation queue/analytics dashboard.

## Fetch Domains

To function correctly, this application makes external HTTP requests to analyze content and synchronize moderation logs. Below are the requested domains and their justifications:

*   `kshitijk20-reddit-hack.hf.space`: Hosts the FastAPI backend server powered by SQLite and Google Gemini. The Devvit app sends posts and comments to this endpoint to evaluate toxicity scores, check for duplicate posts (using vector embeddings), detect escalating flame-wars, and fetch aggregated moderation analytics for the dashboard.
*   `guardian-copilot.loca.lt`: (Development fallback) Used during local development for tunnel connection to a local FastAPI instance.

## Installation & Running

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start playtesting:
   ```bash
   npx devvit playtest
   ```
