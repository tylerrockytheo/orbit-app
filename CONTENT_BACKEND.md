# Orbit content service

This is a backend scaffold, **not yet deployed**.

## Requirements
- A dedicated Supabase project for Orbit.
- Supabase Edge Function named `content-feed`.
- Server-only secret `OPENAI_API_KEY` for optional grounded summaries. Never put this key in GitHub Pages.
- Optional `ORBIT_SUMMARY_MODEL` (defaults to `gpt-4.1-mini`).

## Contract
GET /functions/v1/content-feed returns `{posts,generated_at}`. Each post includes source URL, source name, category, timestamp, summary, and `summary_status`.

## Safety
- AI only receives the publisher-provided description, not arbitrary private user information.
- If source description is missing, returns null summary rather than inventing details.
- Source links are preserved. No article text is republished.
- Public metadata fetches may fail; UI must gracefully handle missing summaries.
- Before production, add persistent caching, rate limiting, ingestion jobs, provider quota controls, source rights review, and stronger article extraction.
- This first feed is Hacker News focused and **not** the full Orbit multimedia/news feed.
- AI calls on every page request would be expensive; enable scheduled processing and cached results before exposing the endpoint widely.

## Frontend integration
Do not remove the current working feed until a deployed backend has been tested. Once the Supabase project is ready, add the public function endpoint to the frontend and render `posts` directly.
