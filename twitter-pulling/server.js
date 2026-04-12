"use strict";

require("dotenv").config();

const useMock = process.env.MOCK_TWITTER === "1";
if (!process.env.TOKEN && !useMock) {
    console.error("ERROR: TOKEN is not set in .env (or set MOCK_TWITTER=1 for local dev)");
    process.exit(1);
}

const express = require("express");
const path = require("path");
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
const PUBLIC_DIR = path.join(__dirname, "public");

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

function parseTopN(rawQ) {
    const q = parseInt(rawQ, 10);
    if (!rawQ || !/^\d+$/.test(rawQ) || isNaN(q) || q < 1 || q > 50) {
        return null;
    }
    return q;
}

async function getTrendsResponse(q) {
    const cached = getCached(q);
    if (cached) {
        return { trends: cached, cached: true, fetched_at: new Date().toISOString() };
    }

    const trendsWithCounts = await fetchTrendsWithCounts();
    if (trendsWithCounts.length === 0) {
        return { trends: [], cached: false, fetched_at: new Date().toISOString() };
    }

    const trends = detectTrends(trendsWithCounts, q);
    cache.set(q, { ts: Date.now(), result: trends });
    return { trends, cached: false, fetched_at: new Date().toISOString() };
}

async function getIdeasResponse() {
    if (!process.env.ANTHROPIC_API_KEY) {
        const error = new Error("ANTHROPIC_API_KEY is not set in .env");
        error.statusCode = 500;
        throw error;
    }

    const cached = cache.get("ideas");
    if (cached && Date.now() - cached.ts < IDEAS_CACHE_TTL_MS) {
        return { ...cached.result, cached: true };
    }

    const trendsWithCounts = await fetchTrendsWithCounts();
    if (trendsWithCounts.length === 0) {
        return { meta_trends: [], ideas: [] };
    }

    // Feed all available trends to the agent for best grouping coverage
    const trends = detectTrends(trendsWithCounts, trendsWithCounts.length);
    const result = await generateIdeas(trends);

    cache.set("ideas", { ts: Date.now(), result });
    const savedPath = savePRDs(result);
    console.log(`PRDs saved to ${savedPath}`);
    return result;
}

app.use(express.static(PUBLIC_DIR));

// ---------------------------------------------------------------------------
// Route: GET /api/trends?q=XX
// ---------------------------------------------------------------------------
app.get("/api/trends", async (req, res, next) => {
    const q = parseTopN(req.query.q);
    if (!q) {
        return res
            .status(400)
            .json({ error: "q must be an integer between 1 and 50" });
    }

    try {
        return res.json(await getTrendsResponse(q));
    } catch (err) {
        next(err);
    }
});

// Backward-compatible legacy route: GET /?q=XX
app.get("/", async (req, res, next) => {
    if (!req.query.q) {
        return res.sendFile(path.join(PUBLIC_DIR, "index.html"));
    }

    const q = parseTopN(req.query.q);
    if (!q) {
        return res
            .status(400)
            .json({ error: "q must be an integer between 1 and 50" });
    }

    try {
        return res.json(await getTrendsResponse(q));
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

app.get("/api/ideas", async (req, res, next) => {
    try {
        return res.json(await getIdeasResponse());
    } catch (err) {
        next(err);
    }
});

app.get("/ideas", async (req, res, next) => {
    try {
        return res.json(await getIdeasResponse());
    } catch (err) {
        next(err);
    }
});

// ---------------------------------------------------------------------------
// Route: GET /ideas/history  — list all saved PRD files
// ---------------------------------------------------------------------------
app.get("/api/ideas/history", (req, res) => {
    const runs = listPRDs();
    res.json({ count: runs.length, runs });
});

app.get("/ideas/history", (req, res) => {
    const runs = listPRDs();
    res.json({ count: runs.length, runs });
});

// ---------------------------------------------------------------------------
// Error middleware
// ---------------------------------------------------------------------------
app.use((err, req, res, _next) => {
    if (err.statusCode) {
        return res.status(err.statusCode).json({ error: err.message });
    }
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
    if (useMock) {
        console.log("MOCK_TWITTER=1 — using synthetic trends (no API calls)");
    }
});
