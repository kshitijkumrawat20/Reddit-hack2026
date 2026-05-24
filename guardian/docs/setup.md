# Setup and Troubleshooting Guide

This document contains additional setup instructions and troubleshooting details for the Guardian AI Moderation Copilot.

## Environment Configurations

The Python backend loads configurations from `guardian/backend/.env`. Here is a detailed breakdown of the settings:

| Variable | Description | Default |
| :--- | :--- | :--- |
| `GEMINI_API_KEY` | Google GenAI API Key | *(Required for AI checks)* |
| `DATABASE_URL` | SQLAlchemy Connection URI | `sqlite+aiosqlite:///./guardian.db` |
| `HOST` | Bind address for FastAPI server | `127.0.0.1` |
| `PORT` | Bind port for FastAPI server | `8000` |
| `TOXICITY_THRESHOLD` | Threshold to flag toxic content | `0.75` |
| `SPAM_THRESHOLD` | Threshold to flag promotional spam | `0.80` |
| `DUPLICATE_THRESHOLD` | Cosine similarity threshold for duplicates | `0.85` |
| `DUPLICATE_CHECK_DAYS` | Embedding lookback range in days | `30` |

---

## Troubleshooting Common Issues

### 1. Devvit CLI Login Fails
If `npx devvit login` fails or redirects infinitely:
*   Try `npx devvit login --copy-paste` to manually copy the auth code from your browser and paste it into the terminal.
*   Clear active sessions by running `npx devvit logout` and try again.

### 2. Devvit App Fails to Contact Backend
If the Devvit app displays "Failed to connect to backend" or doesn't fetch the queue:
*   Verify the Python backend is running locally (`http://localhost:8000`).
*   Ensure that `localhost:8000` is allow-listed in the `devvit.json` under `http.domains`.
*   Check the Devvit logs in your terminal during playtesting:
    ```bash
    npx devvit logs
    ```

### 3. API Key Limit Errors
If the backend throws `429 ResourceExhausted` when calling Gemini:
*   You may be exceeding Google AI Studio's free tier rate limits.
*   The backend will automatically fall back to **Mock Mode** if API calls fail, allowing you to continue testing.
