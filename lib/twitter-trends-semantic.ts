import { createRequire } from "node:module";
import { join } from "node:path";
import {
  sortAndSlugKeywordClusters,
  type KeywordCluster,
  type TwitterTrend,
} from "./twitter-trends.ts";

type AnthropicMessage = {
  content?: Array<{ type?: string; text?: string }>;
};

type AnthropicClient = {
  messages: {
    create: (input: {
      model: string;
      max_tokens: number;
      system: string;
      messages: Array<{ role: "user"; content: string }>;
    }) => Promise<AnthropicMessage>;
  };
};

type SemanticMergeSuggestion = {
  event: string;
  cluster_slugs: string[];
  confidence: number;
  reason: string;
};

const twitterPullingRequire = createRequire(
  join(process.cwd(), "twitter-pulling", "package.json"),
);

const Anthropic = twitterPullingRequire("@anthropic-ai/sdk") as new (options: {
  apiKey: string;
}) => AnthropicClient;

const SEMANTIC_MODEL = "claude-sonnet-4-6";
const SYSTEM_PROMPT =
  "You are resolving whether live Twitter trend clusters refer to the same specific real-world event or story. Return JSON only.";
const MIN_MERGE_CONFIDENCE = 0.85;
const MAX_CANDIDATE_CLUSTERS = 24;

let anthropicClient: AnthropicClient | null = null;

export async function resolveSemanticKeywordClusters(
  trends: TwitterTrend[],
  lexicalClusters: KeywordCluster[],
) {
  if (
    lexicalClusters.length < 2 ||
    !process.env.ANTHROPIC_API_KEY ||
    process.env.MOCK_TWITTER === "1"
  ) {
    return lexicalClusters;
  }

  const candidateClusters = lexicalClusters.slice(0, MAX_CANDIDATE_CLUSTERS);
  const merges = await requestSemanticMergeSuggestions(trends, candidateClusters);

  if (merges.length === 0) {
    return lexicalClusters;
  }

  return applySemanticClusterMerges(lexicalClusters, merges);
}

export function applySemanticClusterMerges(
  clusters: KeywordCluster[],
  suggestions: SemanticMergeSuggestion[],
) {
  if (suggestions.length === 0) {
    return clusters;
  }

  const clusterMap = new Map(clusters.map((cluster) => [cluster.slug, cluster]));
  const claimedSlugs = new Set<string>();
  const approvedSuggestions = suggestions
    .filter(
      (suggestion) =>
        suggestion.confidence >= MIN_MERGE_CONFIDENCE &&
        suggestion.cluster_slugs.length >= 2,
    )
    .sort((left, right) => right.confidence - left.confidence);

  const mergedClusters: Array<Omit<KeywordCluster, "slug"> & { slug?: string }> = [];

  for (const suggestion of approvedSuggestions) {
    const uniqueSlugs = uniqueStrings(
      suggestion.cluster_slugs.filter((slug) => clusterMap.has(slug)),
    );

    if (
      uniqueSlugs.length < 2 ||
      uniqueSlugs.some((slug) => claimedSlugs.has(slug))
    ) {
      continue;
    }

    const sourceClusters = uniqueSlugs
      .map((slug) => clusterMap.get(slug))
      .filter((cluster): cluster is KeywordCluster => Boolean(cluster));

    if (sourceClusters.length < 2) {
      continue;
    }

    for (const slug of uniqueSlugs) {
      claimedSlugs.add(slug);
    }

    const trends = sourceClusters
      .flatMap((cluster) => cluster.trends)
      .sort(
        (left, right) =>
          right.post_count - left.post_count ||
          right.trend_score - left.trend_score,
      );
    const totalPosts = trends.reduce((sum, trend) => sum + trend.post_count, 0);
    const totalScore = trends.reduce((sum, trend) => sum + trend.trend_score, 0);
    const windowPosts =
      clusters.reduce((sum, cluster) => sum + cluster.totalPosts, 0) || 1;

    mergedClusters.push({
      keyword: suggestion.event.trim(),
      trends,
      memberCount: trends.length,
      leadTrend: trends[0],
      totalPosts,
      totalScore,
      shareOfWindow: totalPosts / windowPosts,
      hashtags: uniqueStrings(
        sourceClusters.flatMap((cluster) => cluster.hashtags),
      ).slice(0, 6),
      mergeStrategy: "semantic",
      mergeConfidence: suggestion.confidence,
      mergeReason: suggestion.reason.trim(),
      sourceKeywords: uniqueStrings(
        sourceClusters.flatMap((cluster) => cluster.sourceKeywords ?? [cluster.keyword]),
      ),
    });
  }

  if (mergedClusters.length === 0) {
    return clusters;
  }

  const untouchedClusters = clusters.filter((cluster) => !claimedSlugs.has(cluster.slug));
  return sortAndSlugKeywordClusters([...untouchedClusters, ...mergedClusters]);
}

async function requestSemanticMergeSuggestions(
  trends: TwitterTrend[],
  candidateClusters: KeywordCluster[],
) {
  try {
    const client = getAnthropicClient();
    const response = await client.messages.create({
      model: SEMANTIC_MODEL,
      max_tokens: 1400,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: buildSemanticPrompt(trends, candidateClusters),
        },
      ],
    });

    return parseSemanticMergeSuggestions(
      response.content
        ?.filter((item) => item.type === "text" && item.text)
        .map((item) => item.text ?? "")
        .join("\n") ?? "",
      candidateClusters,
    );
  } catch (error) {
    console.error("semantic cluster resolution failed", {
      detail: error instanceof Error ? error.message : "Unknown error",
    });

    return [];
  }
}

function getAnthropicClient() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  if (!anthropicClient) {
    anthropicClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  return anthropicClient;
}

function buildSemanticPrompt(
  trends: TwitterTrend[],
  candidateClusters: KeywordCluster[],
) {
  const trendWindow = trends.slice(0, 24).map((trend, index) => ({
    rank: index + 1,
    trend: trend.trend,
    posts_per_hour: trend.post_count,
    hashtags: trend.representative_hashtags,
  }));
  const clusterWindow = candidateClusters.map((cluster) => ({
    slug: cluster.slug,
    keyword: cluster.keyword,
    members: cluster.trends.map((trend) => trend.trend),
    member_count: cluster.memberCount,
    posts_per_hour: cluster.totalPosts,
    source_keywords: cluster.sourceKeywords ?? [cluster.keyword],
    hashtags: cluster.hashtags,
  }));

  return [
    "Current live trends:",
    JSON.stringify(trendWindow, null, 2),
    "",
    "Existing lexical clusters:",
    JSON.stringify(clusterWindow, null, 2),
    "",
    "Task: identify only high-confidence cases where two or more listed clusters refer to the same specific live event, match, election, launch, scandal, or storyline.",
    "Merge across different names if they clearly point to the same event context. Example: Orban + Hungary + Hungarian can resolve to Hungarian election if that is the live story.",
    "Do not merge broad themes, countries, or unrelated people just because they are generally associated.",
    "Use only the provided cluster slugs. Never invent new members.",
    "Return a JSON array. Each object must follow:",
    '[{"event":"Hungarian election","cluster_slugs":["orban","hungary"],"confidence":0.92,"reason":"Both clusters point to the same election story in the current trend window."}]',
    "If nothing should merge, return []",
  ].join("\n");
}

function parseSemanticMergeSuggestions(
  raw: string,
  candidateClusters: KeywordCluster[],
) {
  const parsed = parseJson(raw);
  if (!Array.isArray(parsed)) {
    return [];
  }

  const validSlugs = new Set(candidateClusters.map((cluster) => cluster.slug));

  return parsed
    .map((item) => normalizeSuggestion(item, validSlugs))
    .filter((item): item is SemanticMergeSuggestion => Boolean(item));
}

function normalizeSuggestion(
  item: unknown,
  validSlugs: Set<string>,
) {
  if (!item || typeof item !== "object") {
    return null;
  }

  const candidate = item as Partial<SemanticMergeSuggestion>;
  const event = typeof candidate.event === "string" ? candidate.event.trim() : "";
  const confidence =
    typeof candidate.confidence === "number" ? candidate.confidence : Number.NaN;
  const reason = typeof candidate.reason === "string" ? candidate.reason.trim() : "";
  const clusterSlugs = Array.isArray(candidate.cluster_slugs)
    ? uniqueStrings(
        candidate.cluster_slugs.filter(
          (slug): slug is string =>
            typeof slug === "string" && validSlugs.has(slug),
        ),
      )
    : [];

  if (
    !event ||
    !Number.isFinite(confidence) ||
    confidence < 0 ||
    confidence > 1 ||
    !reason ||
    clusterSlugs.length < 2
  ) {
    return null;
  }

  return {
    event,
    cluster_slugs: clusterSlugs,
    confidence,
    reason,
  };
}

function parseJson(raw: string) {
  if (!raw) {
    return null;
  }

  const clean = raw
    .replace(/^```(?:json)?\s*/iu, "")
    .replace(/\s*```$/u, "")
    .trim();

  try {
    return JSON.parse(clean);
  } catch {}

  const start = clean.indexOf("[");
  const end = clean.lastIndexOf("]");

  if (start === -1 || end === -1 || end <= start) {
    return null;
  }

  try {
    return JSON.parse(clean.slice(start, end + 1));
  } catch {
    return null;
  }
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}
