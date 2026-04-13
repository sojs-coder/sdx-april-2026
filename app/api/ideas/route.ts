import { createRequire } from "node:module";
import type { NextRequest } from "next/server";

const require = createRequire(import.meta.url);

const { fetchTrendsWithCounts } = require("../../../twitter-pulling/lib/twitterClient.js");
const { detectTrends } = require("../../../twitter-pulling/lib/trendDetector.js");
const { generateIdeas } = require("../../../twitter-pulling/lib/ideaAgent.js");
const { savePRDs } = require("../../../twitter-pulling/lib/storage.js");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_TTL_MS = 30 * 60 * 1000;
let cache: { ts: number; result: unknown } | null = null;

export async function GET(_request: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      { error: "ANTHROPIC_API_KEY is not set." },
      { status: 500 },
    );
  }

  if (cache && Date.now() - cache.ts < CACHE_TTL_MS) {
    return Response.json({ ...(cache.result as object), cached: true });
  }

  try {
    const trendsWithCounts = await fetchTrendsWithCounts();
    if (!trendsWithCounts.length) {
      return Response.json({ meta_trends: [], ideas: [] });
    }

    const trends = detectTrends(trendsWithCounts, trendsWithCounts.length);
    const result = await generateIdeas(trends);

    cache = { ts: Date.now(), result };
    const savedPath = savePRDs(result);
    console.log(`[ideas] PRDs saved to ${savedPath}`);
    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to generate ideas." },
      { status: 500 },
    );
  }
}
