"use strict";

const Anthropic = require("@anthropic-ai/sdk");

let client;
function getClient() {
    if (!client)
        client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    return client;
}

const SYSTEM =
    "You are a senior software architect. Respond ONLY with a raw JSON object — absolutely no markdown fences, no explanation, no commentary before or after the JSON.";

async function claudeJSON(prompt, maxTokens = 4096) {
    const stream = getClient().messages.stream({
        model: "claude-sonnet-4-6",
        max_tokens: maxTokens,
        system: SYSTEM,
        messages: [{ role: "user", content: prompt }],
    });

    const resp = await stream.finalMessage();
    const text = resp.content[0].text;
    if (resp.stop_reason === "max_tokens") {
        console.error(
            `[PRD] Hit max_tokens (${maxTokens}) — response truncated at ${text.length} chars`,
        );
    }
    return parseJSON(text);
}

function ideaContext(idea) {
    return (
        `Product: ${idea.name}\n` +
        `Tagline: ${idea.tagline}\n` +
        `Problem: ${idea.problem}\n` +
        `Solution: ${idea.solution}\n` +
        `Target customer: ${idea.target_customer}\n` +
        `Revenue model: ${idea.revenue_model}\n` +
        `MVP features: ${idea.mvp_features.join("; ")}`
    );
}

// ── Step 1: Group trends ────────────────────────────────────────────────────
async function groupTrends(trends) {
    const trendList = trends
        .map(
            (t, i) =>
                `${i + 1}. "${t.trend}" — ${t.trend_score.toLocaleString()} tweets/hr`,
        )
        .join("\n");

    const result = await claudeJSON(
        `These topics are currently trending on Twitter:\n\n${trendList}\n\n` +
            `Group trends that refer to the same real-world event into meta-trends. A single trend can stand alone.\n\n` +
            `Return a JSON array sorted by combined_score descending:\n` +
            `[{"name":"Hungarian Election","trends":["Orban","Hungary","Magyar"],"combined_score":345894,"context":"One sentence describing what is happening."}]`,
    );

    const arr = unwrapArray(result);
    if (!arr) {
        return trends.slice(0, 10).map((t) => ({
            name: t.trend,
            trends: [t.trend],
            combined_score: t.trend_score,
            context: `Trending with ${t.trend_score.toLocaleString()} tweets/hr.`,
        }));
    }
    return arr;
}

// ── Step 2: Generate 3 brief ideas ─────────────────────────────────────────
async function generateBriefIdeas(metaTrends) {
    const metaList = metaTrends
        .slice(0, 5)
        .map(
            (m, i) =>
                `${i + 1}. **${m.name}** (${Number(m.combined_score).toLocaleString()} tweets/hr)\n   ${m.context}`,
        )
        .join("\n\n");

    const result = await claudeJSON(
        `These topics are trending on Twitter RIGHT NOW:\n\n${metaList}\n\n` +
            `Generate exactly 3 micro-SaaS ideas. Requirements:\n` +
            `- Buildable solo in 1–4 weeks\n` +
            `- Clear path to $1k–10k MRR\n` +
            `- Tied to why these topics are trending TODAY\n` +
            `- Different target customers\n\n` +
            `Return a JSON array of exactly 3:\n` +
            `[{"name":"","tagline":"","related_trend":"","problem":"","solution":"","target_customer":"","revenue_model":"","mvp_features":["","",""],"why_now":""}]`,
    );

    return unwrapArray(result) || [];
}

// ── Step 3: 4 focused PRD calls per idea ───────────────────────────────────

async function prdOverview(idea) {
    return claudeJSON(
        `${ideaContext(idea)}\n\n` +
            `Return JSON with ONLY these keys — be specific, no TBD:\n` +
            `{\n` +
            `  "auth_flow": ["Step 1: ...", "Step 2: ..."],\n` +
            `  "billing_integration": {\n` +
            `    "provider": "Stripe",\n` +
            `    "plans": [{"name":"","price_monthly":0,"stripe_price_id_placeholder":"price_xxx","features":[""]}],\n` +
            `    "webhook_events": ["event.name — what handler does"],\n` +
            `    "notes": "edge cases"\n` +
            `  },\n` +
            `  "mvp_build_order": ["Day 1: specific tasks", "Day 2: specific tasks"]\n` +
            `}`,
    );
}

async function prdBackend(idea) {
    return claudeJSON(
        `${ideaContext(idea)}\n\n` +
            `Return JSON with ONLY these keys — be specific, no TBD:\n` +
            `{\n` +
            `  "tech_stack": {\n` +
            `    "runtime": "e.g. Node.js 20 — reason",\n` +
            `    "framework": "e.g. Express 4 — reason",\n` +
            `    "database": "e.g. PostgreSQL 15 — reason",\n` +
            `    "auth_library": "e.g. better-auth — reason",\n` +
            `    "hosting": "e.g. Railway for API, Supabase for DB — reason",\n` +
            `    "third_party_apis": ["ServiceName — purpose — free/paid tier"]\n` +
            `  },\n` +
            `  "file_structure": ["path/to/file.ext — what it does"],\n` +
            `  "database_schema": [\n` +
            `    {"table":"name","notes":"purpose","columns":[{"name":"col","type":"SQL type","constraints":"NOT NULL/FK/DEFAULT x","notes":"why"}],"indexes":["col — reason"]}\n` +
            `  ],\n` +
            `  "api_contracts": [\n` +
            `    {"method":"GET","path":"/api/...","auth_required":true,"request_body":{},"query_params":{},"response_200":{},"response_errors":["404 — reason"],"notes":"side effects"}\n` +
            `  ],\n` +
            `  "background_jobs": [{"name":"","trigger":"cron expr or event","description":"","estimated_runtime":"Xs"}],\n` +
            `  "environment_variables": [{"key":"VAR","description":"","example":""}]\n` +
            `}`,
        24288,
    );
}

async function prdFrontend(idea) {
    return claudeJSON(
        `${ideaContext(idea)}\n\n` +
            `Return JSON with ONLY these keys — be specific, no TBD:\n` +
            `{\n` +
            `  "tech_stack": {\n` +
            `    "framework": "e.g. Next.js 14 App Router — reason",\n` +
            `    "styling": "e.g. Tailwind CSS — reason",\n` +
            `    "state_management": "e.g. Zustand — reason",\n` +
            `    "data_fetching": "e.g. SWR — reason",\n` +
            `    "key_libraries": ["lib — purpose"]\n` +
            `  },\n` +
            `  "pages": [\n` +
            `    {\n` +
            `      "route": "/path",\n` +
            `      "name": "Page Name",\n` +
            `      "auth_required": true,\n` +
            `      "description": "what user sees and does",\n` +
            `      "components": ["ComponentName — what it renders"],\n` +
            `      "api_calls": ["METHOD /api/... — when and why"]\n` +
            `    }\n` +
            `  ]\n` +
            `}`,
        24288,
    );
}

async function prdDesign(idea) {
    return claudeJSON(
        `${ideaContext(idea)}\n\n` +
            `Return JSON with ONLY these keys — be specific, no TBD:\n` +
            `{\n` +
            `  "component_library": "e.g. shadcn/ui — reason",\n` +
            `  "design_tokens": {\n` +
            `    "primary": "#hex",\n` +
            `    "primary_dark": "#hex",\n` +
            `    "accent": "#hex",\n` +
            `    "background": "#hex",\n` +
            `    "surface": "#hex",\n` +
            `    "text_primary": "#hex",\n` +
            `    "text_muted": "#hex",\n` +
            `    "error": "#hex",\n` +
            `    "success": "#hex",\n` +
            `    "border_radius": "px",\n` +
            `    "font_sans": "font name",\n` +
            `    "font_mono": "font name"\n` +
            `  },\n` +
            `  "vibe": "2-3 adjectives describing the feel",\n` +
            `  "ux_patterns": ["pattern — where and why used"],\n` +
            `  "key_screens": [\n` +
            `    {"screen":"name","layout":"describe the layout","key_interactions":["user does X → Y happens"]}\n` +
            `  ]\n` +
            `}`,
    );
}

async function generateTechPRD(idea) {
    // 4 parallel focused calls — each stays well under 4k tokens
    const [overviewRes, backendRes, frontendRes, designRes] =
        await Promise.allSettled([
            prdOverview(idea),
            prdBackend(idea),
            prdFrontend(idea),
            prdDesign(idea),
        ]);

    function unwrap(res, label) {
        if (res.status === "rejected") {
            console.error(
                `[PRD:${label}] call rejected for "${idea.name}":`,
                res.reason?.message,
            );
            return null;
        }
        if (!res.value || !Object.keys(res.value).length) {
            console.error(
                `[PRD:${label}] parse returned empty for "${idea.name}"`,
            );
            return null;
        }
        return res.value;
    }

    return {
        overview: unwrap(overviewRes, "overview"),
        backend: unwrap(backendRes, "backend"),
        frontend: unwrap(frontendRes, "frontend"),
        design: unwrap(designRes, "design"),
    };
}

// ── Main export ─────────────────────────────────────────────────────────────
async function generateIdeas(trends) {
    const metaTrends = await groupTrends(trends);

    const ideas = await generateBriefIdeas(metaTrends);
    if (!ideas.length) return { meta_trends: metaTrends, ideas: [] };

    // PRDs sequentially (4 parallel calls per idea, 3 ideas in sequence)
    const enrichedIdeas = [];
    for (const idea of ideas) {
        console.log(`[PRD] Generating 4-part PRD for "${idea.name}"...`);
        const full_prd = await generateTechPRD(idea);
        enrichedIdeas.push({ ...idea, full_prd });
    }

    return { meta_trends: metaTrends, ideas: enrichedIdeas };
}

function parseJSON(text) {
    if (!text) return null;
    // Strategy 1: direct parse after stripping fences
    try {
        const clean = text
            .replace(/^```(?:json)?\s*/i, "")
            .replace(/\s*```\s*$/i, "")
            .trim();
        return JSON.parse(clean);
    } catch {}
    // Strategy 2: extract first complete {...} or [...] block by brace matching
    try {
        const brace = text.indexOf("{");
        const bracket = text.indexOf("[");
        const opener =
            bracket !== -1 && (brace === -1 || bracket < brace) ? "[" : "{";
        const closer = opener === "[" ? "]" : "}";
        const start = text.indexOf(opener);
        if (start === -1) return null;
        let depth = 0,
            end = -1;
        for (let i = start; i < text.length; i++) {
            if (text[i] === opener) depth++;
            else if (text[i] === closer && --depth === 0) {
                end = i;
                break;
            }
        }
        if (end === -1) return null;
        return JSON.parse(text.slice(start, end + 1));
    } catch {}
    return null;
}

/**
 * If the model wraps an array in an object (e.g. {"meta_trends": [...]}),
 * find and return the first array value inside it.
 */
function unwrapArray(result) {
    if (Array.isArray(result)) return result;
    if (result && typeof result === "object") {
        for (const val of Object.values(result)) {
            if (Array.isArray(val)) return val;
        }
    }
    return null;
}

module.exports = { generateIdeas };
