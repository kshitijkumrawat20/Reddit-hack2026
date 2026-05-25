FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies if any
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code
COPY . .

# Set environment variables for Hugging Face Spaces
ENV HOST=0.0.0.0
ENV PORT=7860
ENV DATABASE_URL=sqlite+aiosqlite:////app/guardian.db

# Expose port
EXPOSE 7860

# Run uvicorn server
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
