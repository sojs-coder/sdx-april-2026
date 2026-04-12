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
const { generateIdeas } = require("./lib/ideaAgent");
const { savePRDs, listPRDs } = require("./lib/storage");

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
// Route: GET /ideas
// Fetches current trends, groups related ones, generates 3 micro-SaaS PRDs.
// Cached for 15 minutes (LLM calls are expensive and trends don't shift that fast).
// ---------------------------------------------------------------------------
const IDEAS_CACHE_TTL_MS = 30 * 60 * 1000;

app.get("/ideas", async (req, res, next) => {
    if (!process.env.ANTHROPIC_API_KEY) {
        return res.status(500).json({ error: "ANTHROPIC_API_KEY is not set in .env" });
    }

    const cached = cache.get("ideas");
    if (cached && Date.now() - cached.ts < IDEAS_CACHE_TTL_MS) {
        return res.json({ ...cached.result, cached: true });
    }

    try {
        const trendsWithCounts = await fetchTrendsWithCounts();
        if (trendsWithCounts.length === 0) {
            return res.json({ meta_trends: [], ideas: [] });
        }

        // Feed all available trends to the agent for best grouping coverage
        const trends = detectTrends(trendsWithCounts, trendsWithCounts.length);
        const result = await generateIdeas(trends);

        cache.set("ideas", { ts: Date.now(), result });
        const savedPath = savePRDs(result);
        console.log(`PRDs saved to ${savedPath}`);
        return res.json(result);
    } catch (err) {
        next(err);
    }
});

// ---------------------------------------------------------------------------
// Route: GET /ideas/history  — list all saved PRD files
// ---------------------------------------------------------------------------
app.get("/ideas/history", (req, res) => {
    const runs = listPRDs();
    res.json({ count: runs.length, runs });
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
