---
title: Reddit Hack 2026
emoji: 🛡️
colorFrom: red
colorTo: gray
sdk: docker
app_port: 7860
pinned: false
---

# Guardian AI Moderator Backend

This is the FastAPI python backend for the Guardian AI Moderator Reddit Application. It is deployed as a Docker container on Hugging Face Spaces.

## Architecture
- **Framework**: FastAPI
- **Database**: SQLite (SQLModel + aiosqlite)
- **AI Models**: Google Gemini 1.5 Flash (for toxicity & escalation checks) & text-embedding-004 (for duplicates detection)
