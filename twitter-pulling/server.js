'use strict';

require('dotenv').config();

if (!process.env.TOKEN) {
  console.error('ERROR: TOKEN is not set in .env');
  process.exit(1);
}

const express = require('express');
const { fetchRecentTweets, AuthError, RateLimitError, QueryError } = require('./lib/twitterClient');
const { detectTrends } = require('./lib/trendDetector');

const app = express();
const PORT = process.env.PORT || 3000;

// ---------------------------------------------------------------------------
// In-memory response cache: Map<q, { ts: number, result: Array }>
// TTL: 5 minutes — protects Basic-tier rate limit (each req triggers up to 5 API calls)
// ---------------------------------------------------------------------------
const cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

function getCached(q) {
  const entry = cache.get(q);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    cache.delete(q);
    return null;
  }
  return entry.result;
}

// ---------------------------------------------------------------------------
// Route: GET /?q=XX
// ---------------------------------------------------------------------------
app.get('/', async (req, res, next) => {
  const q = parseInt(req.query.q, 10);
  if (isNaN(q) || q < 1 || q > 50) {
    return res.status(400).json({ error: 'q must be an integer between 1 and 50' });
  }

  const cached = getCached(q);
  if (cached) {
    return res.json({ trends: cached, cached: true });
  }

  try {
    const tweets = await fetchRecentTweets(q);
    if (tweets.length === 0) {
      return res.json({ trends: [] });
    }

    const trends = detectTrends(tweets, q);
    cache.set(q, { ts: Date.now(), result: trends });
    return res.json({ trends });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Error middleware
// ---------------------------------------------------------------------------
app.use((err, req, res, _next) => {
  if (err instanceof AuthError) {
    return res.status(500).json({ error: 'Twitter authentication failed — check TOKEN in .env' });
  }
  if (err instanceof RateLimitError) {
    const body = { error: 'Twitter rate limit hit. Try again later.' };
    if (err.retryAfter) body.retry_after = err.retryAfter;
    return res.status(429).json(body);
  }
  if (err instanceof QueryError) {
    return res.status(500).json({ error: 'Internal Twitter query error', detail: err.message });
  }
  console.error('Unhandled error:', err);
  return res.status(500).json({ error: 'Internal server error' });
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`Twitter trend server running on http://localhost:${PORT}`);
  console.log(`Example: http://localhost:${PORT}/?q=10`);
});
