"use strict";

require("dotenv").config();

if (!process.env.TOKEN) {
    console.error("ERROR: TOKEN is not set in .env");
    process.exit(1);
}

const express = require("express");
const {
    fetchTrendsWithCounts,
    AuthError,
    RateLimitError,
} = require("./lib/twitterClient");
const { detectTrends } = require("./lib/trendDetector");

const app = express();
const PORT = process.env.PORT || 3000;

// ---------------------------------------------------------------------------
// In-memory response cache: Map<q, { ts: number, result: Array }>
// TTL: 5 minutes — protects rate limit (each req triggers 1 trends call + ~20 count calls)
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
app.get("/", async (req, res, next) => {
    const rawQ = req.query.q;
    const q = parseInt(rawQ, 10);
    if (!rawQ || !/^\d+$/.test(rawQ) || isNaN(q) || q < 1 || q > 50) {
        return res
            .status(400)
            .json({ error: "q must be an integer between 1 and 50" });
    }

    const cached = getCached(q);
    if (cached) {
        return res.json({ trends: cached, cached: true });
    }

    try {
        const trendsWithCounts = await fetchTrendsWithCounts();
        if (trendsWithCounts.length === 0) {
            return res.json({ trends: [] });
        }

        const trends = detectTrends(trendsWithCounts, q);
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
        return res
            .status(500)
            .json({
                error: "Twitter authentication failed — check TOKEN in .env",
            });
    }
    if (err instanceof RateLimitError) {
        const body = { error: "Twitter rate limit hit. Try again later." };
        if (err.retryAfter) body.retry_after = err.retryAfter;
        return res.status(429).json(body);
    }
console.error("Unhandled error:", err);
    return res.status(500).json({ error: "Internal server error" });
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
    console.log(`Twitter trend server running on http://localhost:${PORT}`);
    console.log(`Example: http://localhost:${PORT}/?q=10`);
});
