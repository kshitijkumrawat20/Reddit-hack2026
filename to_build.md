# Reddit Guardian AI — Reddit-Native Final Build Prompt

# PROJECT OVERVIEW

Build a polished Reddit-native AI moderation copilot application called:

# Guardian

## “AI Moderator Copilot for Reddit Communities”

Guardian is NOT an enterprise moderation dashboard.

Guardian should feel:

* lightweight
* Reddit-native
* interactive
* moderator-friendly
* community-centric
* fast
* intelligent
* embedded naturally into moderation workflows

The application should help moderators:

* reduce moderation workload
* detect toxic content
* identify spam
* detect reposts
* prioritize dangerous discussions
* explain moderation recommendations
* respond faster to escalating conversations

The experience should feel like:

# “An intelligent moderator assistant living inside Reddit.”

NOT:

* a corporate admin panel
* enterprise SaaS software
* fully autonomous moderation AI

Moderators must ALWAYS remain in control.

---

# DESIGN PHILOSOPHY

The product should prioritize:

# 1. Moderator Productivity

Every feature should save moderator time.

---

# 2. Embedded Reddit UX

The app should feel native to Reddit moderation workflows.

Avoid:

* complicated enterprise dashboards
* overwhelming analytics pages
* bloated UI

Prefer:

* inline moderation suggestions
* lightweight moderation cards
* contextual actions
* fast moderation workflows

---

# 3. AI As Assistant

The AI should:

* recommend
* explain
* prioritize
* summarize

The AI should NOT:

* autonomously ban users
* remove moderator control
* fully automate moderation

---

# 4. Delightful UX

The application should feel:

* clean
* responsive
* modern
* slightly playful
* Reddit-friendly

Use:

* smart badges
* clean cards
* contextual warnings
* intelligent suggestions

---

# CORE FEATURES

# 1. Guardian AI Moderation Feed

Create an interactive moderation feed.

Example card:

```text
🚨 Potential Harassment Detected

Guardian detected possible Rule #2 violation.

Confidence: 91%
Reason: Direct personal attack detected.

Recommended Action:
Remove Post

[Approve]
[Remove]
[Warn User]
[Ignore]
```

This feed is the PRIMARY UX.

It should feel:

* lightweight
* actionable
* interactive
* Reddit-native

---

# 2. Toxicity Detection

Detect:

* harassment
* hate speech
* abusive language
* threats
* NSFW/toxic content

Provide:

* toxicity score
* severity level
* moderation recommendation
* concise explanation

---

# 3. Spam Detection

Detect:

* spam links
* repetitive promotions
* suspicious posting behavior
* bot-like activity

Use:

* regex
* heuristics
* lightweight ML logic

---

# 4. Escalation Detection (Killer Feature)

Guardian should detect:

* hostile conversations
* flame wars
* rapidly escalating toxicity
* controversial discussions

Example:

```text
⚠️ Thread Escalation Detected

Guardian noticed increasing hostility in this discussion.

Moderator review recommended.
```

This should feel:

* intelligent
* proactive
* community-aware

---

# 5. Repost / Duplicate Detection

Detect:

* duplicate questions
* reposted discussions
* repeated community topics

Use:

* sentence-transformers
* cosine similarity

Example:

```text
🔁 Similar Discussion Found

92% similarity with an existing thread.

[View Similar Post]
[Ignore]
```

---

# 6. AI Moderation Explanations

Guardian must explain WHY moderation was suggested.

Example:

```text
Guardian believes this content may violate Rule #3 because it contains direct insults toward another community member.
```

Explanations should be:

* concise
* human-readable
* moderator-friendly
* transparent

---

# 7. Smart Queue Prioritization

Prioritize:

* highly toxic discussions
* escalating threads
* suspicious users
* viral controversial posts

Use:

* severity badges
* priority labels
* confidence indicators

---

# 8. Human-in-the-Loop Moderation

Moderators MUST always have:

* Approve
* Remove
* Warn User
* Ignore
* Override AI

AI decisions are recommendations ONLY.

---

# 9. False Positive Feedback

Allow moderators to mark:

* false positive
* incorrect moderation suggestion
* bad AI reasoning

Example:

```text
Was Guardian wrong?
[Yes]
[No]
```

This creates:

* trust
* better UX
* human oversight

---

# OPTIONAL FEATURE

# Community Health Insights

Provide lightweight analytics:

* toxicity trend
* spam trend
* moderation workload
* escalating discussions

Avoid creating giant enterprise analytics dashboards.

Keep it:

* simple
* visual
* lightweight

---

# TECH STACK

# Reddit Integration

Use:

* Reddit Devvit
* moderation hooks
* menu actions
* post actions
* contextual UI components

The app should feel deeply integrated into Reddit.

---

# Backend

Use:

* Python
* FastAPI

Requirements:

* async APIs
* clean modular architecture
* lightweight services

---

# AI Stack

Use:

* Gemini API OR OpenAI API
* sentence-transformers

Optional:

* Detoxify
* OpenAI moderation API

---

# Database

Use:

* PostgreSQL
  OR
* Supabase

Store:

* moderation logs
* embeddings
* feedback
* moderation history

---

# Cache

Use:

* Redis

For:

* moderation caching
* queue state
* repeated checks

---

# FINAL ARCHITECTURE

```text
Reddit Post
     ↓
Guardian Devvit Trigger
     ↓
FastAPI AI Backend
     ↓
Moderation Analysis
 ├── Toxicity Detection
 ├── Spam Detection
 ├── Escalation Detection
 ├── Similarity Search
 └── AI Explanation Engine
     ↓
Guardian Moderation Feed
     ↓
Moderator Actions
```

---

# FOLDER STRUCTURE

```text
guardian/
│
├── backend/
│   ├── api/
│   ├── moderation/
│   ├── embeddings/
│   ├── analytics/
│   ├── services/
│   └── utils/
│
├── devvit-app/
│   ├── actions/
│   ├── hooks/
│   ├── cards/
│   ├── feeds/
│   └── config/
│
├── dashboard/
├── docs/
└── README.md
```

---

# IMPORTANT UX REQUIREMENTS

The UI should feel:

* fast
* modern
* interactive
* embedded into Reddit workflows
* lightweight

DO NOT create:

* bloated admin dashboards
* enterprise SaaS feeling
* overly technical interfaces

Focus on:

* moderation cards
* contextual moderation suggestions
* quick actions
* inline workflows

---

# ENGINEERING REQUIREMENTS

# Use Async APIs

Use async FastAPI everywhere.

---

# Add Logging

Track:

* moderation actions
* AI latency
* false positives
* escalations detected

---

# Add Error Handling

Handle:

* AI failures
* API timeouts
* malformed content
* moderation edge cases

---

# Add Caching

Cache:

* moderation results
* embeddings
* repeated content checks

---

# ADD PERSONALITY TO GUARDIAN

Guardian should feel like a helpful moderator companion.

Example messages:

```text
Guardian recommends moderator review.
```

```text
Guardian detected a potentially hostile discussion.
```

```text
Guardian found a similar thread.
```

Avoid:

* robotic enterprise tone
* overly formal system messages

---

# MVP PRIORITY

# MUST BUILD

* Devvit integration
* moderation feed
* toxicity detection
* AI explanations
* moderator actions
* escalation detection
* smart queue

---

# NICE TO HAVE

* repost detection
* community insights
* embeddings search
* analytics

---

# DEPLOYMENT

# Backend

Deploy on:

* Railway
  OR
* Render

---

# Database

Use:

* Supabase

---

# Devvit

Deploy using:

* Reddit Devvit platform

---

# README REQUIREMENTS

Include:

# 1. Problem

Moderator overload.

# 2. Solution

Guardian AI Moderator Copilot.

# 3. Features

Clear feature breakdown.

# 4. Architecture

Simple architecture diagram.

# 5. Screenshots

Important.

# 6. Demo Video

Very important.

# 7. Community Impact

Explain:

* moderation efficiency
* reduced moderator fatigue
* faster moderation workflows
* improved community safety

---

# DEMO VIDEO FLOW

# 1. Explain Problem

Moderation overload.

# 2. Show Guardian Feed

Interactive moderation cards.

# 3. Show AI Explanations

Moderation reasoning.

# 4. Show Escalation Detection

Hostile thread detection.

# 5. Show Moderator Actions

Approve/remove/warn.

# 6. Explain Impact

Why moderators would use Guardian.

---

# DO NOT OVERENGINEER

Avoid:

* unnecessary microservices
* complex LangGraph orchestration
* giant dashboards
* excessive infrastructure complexity

Hackathon success depends more on:

* UX
* polish
* usefulness
* moderation productivity
* Reddit-native feel

than infrastructure complexity.

---

# FINAL POSITIONING

# Guardian

“An AI-powered Moderator Copilot for Reddit communities that helps moderators reduce workload using explainable AI moderation suggestions, escalation detection, and smart moderation workflows integrated directly into Reddit.”
