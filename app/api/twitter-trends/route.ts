import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";
import type { NextRequest } from "next/server";
import {
  buildKeywordClusters,
  buildTwitterTrendsSnapshot,
  type TwitterTrendsResponse,
} from "@/lib/twitter-trends";
import { resolveSemanticKeywordClusters } from "@/lib/twitter-trends-semantic";

const require = createRequire(import.meta.url);

type TrendWithCount = {
  trend_name: string;
  tweet_count: number;
};

type DetectedTrend = {
  trend: string;
  trend_score: number;
  post_count: number;
  representative_hashtags: string[];
};

type AuthErrorType = new (message: string) => Error;
type RateLimitErrorInstance = Error & { retryAfter?: number | null };
type RateLimitErrorType = new (
  message: string,
  retryAfter?: number | null,
) => RateLimitErrorInstance;

const {
  fetchTrendsWithCounts,
  AuthError,
  RateLimitError,
}: {
  fetchTrendsWithCounts: () => Promise<TrendWithCount[]>;
  AuthError: AuthErrorType;
  RateLimitError: RateLimitErrorType;
} = require("../../../twitter-pulling/lib/twitterClient.js");

const { detectTrends }: {
  detectTrends: (trendsWithCounts: TrendWithCount[], topN: number) => DetectedTrend[];
} = require("../../../twitter-pulling/lib/trendDetector.js");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_TRENDS = 50;
type CachedPayload = Omit<TwitterTrendsResponse, "cached" | "fetched_at">;

const cache = new Map<
  number,
  { fetchedAt: string; result: CachedPayload; ts: number }
>();

let envLoadPromise: Promise<void> | null = null;

function parseLimit(rawLimit: string | null) {
  const limit = Number.parseInt(rawLimit ?? "", 10);
  if (!rawLimit || !Number.isInteger(limit) || limit < 1 || limit > MAX_TRENDS) {
    return null;
  }

  return limit;
}

function getCached(limit: number) {
  const entry = cache.get(limit);
  if (!entry) {
    return null;
  }

  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    cache.delete(limit);
    return null;
  }

  return entry;
}

function applyEnvFile(raw: string) {
  for (const line of raw.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex < 1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    if (!key || process.env[key]) {
      continue;
    }

    let value = trimmed.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

async function ensureExtractorEnv() {
  if (
    process.env.MOCK_TWITTER === "1" ||
    (process.env.TOKEN && process.env.ANTHROPIC_API_KEY)
  ) {
    return;
  }

  if (!envLoadPromise) {
    envLoadPromise = readFile(
      join(process.cwd(), "twitter-pulling", ".env"),
      "utf8",
    )
      .then(applyEnvFile)
      .catch(() => undefined);
  }

  await envLoadPromise;
}

export async function GET(request: NextRequest) {
  const limit = parseLimit(request.nextUrl.searchParams.get("q"));

  if (!limit) {
    return Response.json(
      { error: "q must be an integer between 1 and 50" },
      { status: 400 },
    );
  }

  await ensureExtractorEnv();

  const cached = getCached(limit);
  if (cached) {
    return Response.json({
      ...cached.result,
      cached: true,
      fetched_at: cached.fetchedAt,
    });
  }

  try {
    const trendsWithCounts = await fetchTrendsWithCounts();
    const trends = detectTrends(trendsWithCounts, limit);
    const lexicalClusters = buildKeywordClusters(trends);
    const semanticClusters = await resolveSemanticKeywordClusters(
      trends,
      lexicalClusters,
    );
    const snapshot = buildTwitterTrendsSnapshot(trends, semanticClusters);
    const fetchedAt = new Date().toISOString();

    cache.set(limit, {
      fetchedAt,
      result: {
        trends: snapshot.trends,
        clusters: snapshot.clusters,
        trend_count: snapshot.trendCount,
        cluster_count: snapshot.clusterCount,
        window_posts: snapshot.windowPosts,
      },
      ts: Date.now(),
    });

    return Response.json({
      trends: snapshot.trends,
      clusters: snapshot.clusters,
      trend_count: snapshot.trendCount,
      cluster_count: snapshot.clusterCount,
      window_posts: snapshot.windowPosts,
      cached: false,
      fetched_at: fetchedAt,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return Response.json(
        { error: "Twitter authentication failed. Check TOKEN in twitter-pulling/.env." },
        { status: 500 },
      );
    }

    if (error instanceof RateLimitError) {
      return Response.json(
        {
          error: "Twitter rate limit hit. Try again later.",
          retry_after:
            typeof error.retryAfter === "number" ? error.retryAfter : null,
        },
        { status: 429 },
      );
    }

    const detail =
      error instanceof Error
        ? error.message
        : "Unknown error";

    console.error("twitter-trends route failed", {
      detail,
      error,
      fetchedAt: new Date().toISOString(),
      limit,
    });

    return Response.json(
      {
        error: "Unable to fetch current Twitter trends.",
        detail,
      },
      { status: 500 },
    );
  }
}
