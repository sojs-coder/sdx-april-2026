export interface TwitterTrend {
  trend: string;
  trend_score: number;
  post_count: number;
  representative_hashtags: string[];
}

export const DASHBOARD_TRENDS_LIMIT = 40;

export interface TwitterTrendsResponse {
  trends: TwitterTrend[];
  clusters: KeywordCluster[];
  trend_count: number;
  cluster_count: number;
  window_posts: number;
  cached: boolean;
  fetched_at: string;
}

export interface TwitterTrendsState {
  trends: TwitterTrend[];
  clusters: KeywordCluster[];
  cached: boolean;
  fetchedAt: string | null;
  trendCount: number;
  clusterCount: number;
  windowPosts: number;
  isLoading: boolean;
  error: string | null;
  connected: boolean;
}

export interface KeywordCluster {
  keyword: string;
  slug: string;
  trends: TwitterTrend[];
  memberCount: number;
  leadTrend: TwitterTrend;
  totalPosts: number;
  totalScore: number;
  shareOfWindow: number;
  hashtags: string[];
  mergeStrategy: "lexical" | "semantic";
  mergeConfidence?: number;
  mergeReason?: string;
  sourceKeywords?: string[];
}

export interface TwitterTrendsSnapshot {
  trends: TwitterTrend[];
  clusters: KeywordCluster[];
  trendCount: number;
  clusterCount: number;
  windowPosts: number;
}

const STOPWORDS = new Set([
  "about",
  "after",
  "and",
  "against",
  "along",
  "amid",
  "among",
  "around",
  "because",
  "before",
  "being",
  "breaking",
  "could",
  "from",
  "have",
  "here",
  "into",
  "live",
  "just",
  "more",
  "news",
  "our",
  "over",
  "should",
  "some",
  "than",
  "that",
  "their",
  "there",
  "these",
  "the",
  "they",
  "this",
  "those",
  "today",
  "topic",
  "under",
  "versus",
  "via",
  "vs",
  "what",
  "when",
  "where",
  "which",
  "with",
  "world",
]);

export function formatCompactNumber(value: number) {
  const absolute = Math.abs(value);

  if (absolute >= 1_000_000) {
    return `${trimDecimal(value / 1_000_000)}M`;
  }

  if (absolute >= 1_000) {
    return `${trimDecimal(value / 1_000)}K`;
  }

  return String(value);
}

export function formatFetchedAtLabel(value: string | null) {
  if (!value || value.length < 19) {
    return "--:--:--";
  }

  return `${value.slice(11, 19)}Z`;
}

export function formatPercent(value: number) {
  const percent = value * 100;

  if (percent > 0 && percent < 1) {
    return "<1%";
  }

  if (percent >= 1 && percent < 10) {
    return `${percent.toFixed(1).replace(/\.0$/, "")}%`;
  }

  return `${Math.round(percent)}%`;
}

export function trendSlug(trend: string) {
  return (
    trend
      .replace(/^#/, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "trend"
  );
}

export function displayKeyword(keyword: string) {
  return keyword.length <= 4 ? keyword.toUpperCase() : keyword;
}

export function getTrendKeywords(trend: TwitterTrend) {
  const hashtagKeywords = trend.representative_hashtags.flatMap((tag) =>
    expandKeywordParts(tag, { preserveShortKeywords: true }),
  );
  const tokenKeywords = [trend.trend, ...trend.trend.split(/[^a-zA-Z0-9#]+/u)]
    .flatMap((token) =>
      expandKeywordParts(token, {
        preserveShortKeywords: isShortSignalToken(token),
      }),
    );

  return uniqueStrings([...hashtagKeywords, ...tokenKeywords]);
}

export function buildKeywordClusters(trends: TwitterTrend[]) {
  const totalWindowPosts =
    trends.reduce((sum, trend) => sum + trend.post_count, 0) || 1;
  const trendKeywords = trends.map((trend) => ({
    trend,
    keywords: new Set(getTrendKeywords(trend)),
  }));
  const visited = new Set<number>();
  const clusters = [];

  for (let index = 0; index < trendKeywords.length; index += 1) {
    if (visited.has(index)) {
      continue;
    }

    const queue = [index];
    const componentIndexes = [];
    visited.add(index);

    while (queue.length > 0) {
      const current = queue.shift();
      if (current === undefined) {
        continue;
      }

      componentIndexes.push(current);

      for (let candidate = 0; candidate < trendKeywords.length; candidate += 1) {
        if (visited.has(candidate)) {
          continue;
        }

        if (
          haveKeywordOverlap(
            trendKeywords[current].keywords,
            trendKeywords[candidate].keywords,
          )
        ) {
          visited.add(candidate);
          queue.push(candidate);
        }
      }
    }

    const clusterTrends = componentIndexes
      .map((componentIndex) => trendKeywords[componentIndex].trend)
      .sort(
        (left, right) =>
          right.post_count - left.post_count ||
          right.trend_score - left.trend_score,
      );
    const totalPosts = clusterTrends.reduce(
      (sum, trend) => sum + trend.post_count,
      0,
    );
    const totalScore = clusterTrends.reduce(
      (sum, trend) => sum + trend.trend_score,
      0,
    );
    const keywordScores = new Map<string, number>();

    for (const componentIndex of componentIndexes) {
      for (const keyword of trendKeywords[componentIndex].keywords) {
        keywordScores.set(
          keyword,
          (keywordScores.get(keyword) ?? 0) +
            trendKeywords[componentIndex].trend.post_count,
        );
      }
    }

    const keyword =
      Array.from(keywordScores.entries()).sort(
        (left, right) =>
          right[1] - left[1] ||
          right[0].length - left[0].length ||
          left[0].localeCompare(right[0]),
      )[0]?.[0] ?? trendSlug(clusterTrends[0]?.trend ?? "trend");

    clusters.push({
      keyword,
      slug: "",
      trends: clusterTrends,
      memberCount: clusterTrends.length,
      leadTrend: clusterTrends[0],
      totalPosts,
      totalScore,
      shareOfWindow: totalPosts / totalWindowPosts,
      hashtags: uniqueStrings(
        clusterTrends.flatMap((trend) => trend.representative_hashtags),
      ).slice(0, 6),
      mergeStrategy: "lexical",
      sourceKeywords: Array.from(keywordScores.keys()).sort((left, right) =>
        left.localeCompare(right),
      ),
    } satisfies KeywordCluster);
  }

  return sortAndSlugKeywordClusters(clusters);
}

export function buildTwitterTrendsSnapshot(
  trends: TwitterTrend[],
  clusters: KeywordCluster[] = buildKeywordClusters(trends),
): TwitterTrendsSnapshot {
  const windowPosts = trends.reduce((sum, trend) => sum + trend.post_count, 0);

  return {
    trends,
    clusters,
    trendCount: trends.length,
    clusterCount: clusters.length,
    windowPosts,
  };
}

export function findKeywordCluster(
  clusters: KeywordCluster[],
  slug: string,
) {
  return clusters.find((cluster) => cluster.slug === slug) ?? null;
}

export function getRelatedKeywordClusters(
  clusters: KeywordCluster[],
  selectedCluster: KeywordCluster | null,
) {
  if (!selectedCluster) {
    return clusters;
  }

  const selectedMembers = new Set(
    selectedCluster.trends.map((trend) => trend.trend),
  );

  return [...clusters].sort((left, right) => {
    const leftOverlap = left.trends.filter((trend) =>
      selectedMembers.has(trend.trend),
    ).length;
    const rightOverlap = right.trends.filter((trend) =>
      selectedMembers.has(trend.trend),
    ).length;

    return (
      rightOverlap - leftOverlap ||
      right.totalPosts - left.totalPosts ||
      left.keyword.localeCompare(right.keyword)
    );
  });
}

export function sortAndSlugKeywordClusters(
  clusters: Array<Omit<KeywordCluster, "slug"> & { slug?: string }>,
) {
  const sortedClusters = [...clusters].sort(
    (left, right) =>
      right.totalPosts - left.totalPosts ||
      right.memberCount - left.memberCount ||
      left.keyword.localeCompare(right.keyword),
  );

  const slugCounts = new Map<string, number>();

  return sortedClusters.map((cluster) => {
    const baseSlug = safeClusterSlug(cluster.keyword);
    const count = (slugCounts.get(baseSlug) ?? 0) + 1;
    slugCounts.set(baseSlug, count);

    return {
      ...cluster,
      slug: count === 1 ? baseSlug : `${baseSlug}-${count}`,
    };
  });
}

function expandKeywordParts(
  value: string,
  options: { preserveShortKeywords?: boolean } = {},
) {
  const splitSource = value
    .replace(/^#/, "")
    .match(/[A-Z]+(?=[A-Z][a-z]|\b)|[A-Z]?[a-z]+|[0-9]+/g)
    ?.join(" ") ?? value.replace(/^#/, "");
  const base = normalizeKeyword(value);
  if (!base) {
    return [];
  }

  const parts = [];
  const splitParts = splitSource
    .split(/[^a-zA-Z0-9]+/u)
    .map(normalizeKeyword)
    .filter((keyword) => isClusterKeyword(keyword, options));

  if (splitParts.length <= 1) {
    const stemmedBase = stemKeyword(base);
    if (isClusterKeyword(stemmedBase, options)) {
      parts.push(stemmedBase);
    }
  } else {
    if (isClusterKeyword(base, options)) {
      parts.push(base);
    }
    parts.push(...splitParts.map(stemKeyword));
  }

  return uniqueStrings(parts);
}

function normalizeKeyword(value: string) {
  return value
    .replace(/^#/, "")
    .normalize("NFKD")
    .replace(/\p{Mark}+/gu, "")
    .toLowerCase()
    .trim();
}

function stemKeyword(value: string) {
  if (value.endsWith("ies") && value.length > 4) {
    return `${value.slice(0, -3)}y`;
  }

  if (value.endsWith("es") && value.length > 4) {
    return value.slice(0, -2);
  }

  if (value.endsWith("s") && value.length > 3) {
    return value.slice(0, -1);
  }

  return value;
}

function safeClusterSlug(keyword: string) {
  const baseSlug = trendSlug(keyword);

  if (baseSlug !== "trend" || keyword === "trend") {
    return baseSlug;
  }

  return `kw-${simpleHash(keyword)}`;
}

function simpleHash(value: string) {
  let hash = 0;

  for (const character of value) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }

  return hash.toString(36);
}

function trimDecimal(value: number) {
  return value.toFixed(1).replace(/\.0$/, "");
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function isClusterKeyword(
  keyword: string,
  options: { preserveShortKeywords?: boolean } = {},
) {
  const hasAsciiSignal = /[a-z0-9]/u.test(keyword);
  const hasNonAsciiSignal =
    !hasAsciiSignal &&
    keyword.replace(/[\s._-]+/gu, "").length >= 2;

  if (
    !keyword ||
    STOPWORDS.has(keyword) ||
    (!hasAsciiSignal && !hasNonAsciiSignal)
  ) {
    return false;
  }

  if (keyword.length >= 3) {
    return true;
  }

  return Boolean(
    options.preserveShortKeywords && /^[a-z0-9]{2,}$/u.test(keyword),
  );
}

function isShortSignalToken(value: string) {
  const normalized = value.replace(/^#/, "").trim();

  return (
    normalized.length >= 2 &&
    normalized.length <= 4 &&
    /[A-Z0-9]/u.test(normalized) &&
    normalized === normalized.toUpperCase()
  );
}

function haveKeywordOverlap(left: Set<string>, right: Set<string>) {
  for (const keyword of left) {
    if (right.has(keyword)) {
      return true;
    }
  }

  for (const leftKeyword of left) {
    for (const rightKeyword of right) {
      if (areKeywordsLexicallyRelated(leftKeyword, rightKeyword)) {
        return true;
      }
    }
  }

  return false;
}

function areKeywordsLexicallyRelated(left: string, right: string) {
  if (left === right || !canUseLexicalSimilarity(left) || !canUseLexicalSimilarity(right)) {
    return false;
  }

  const shorter = left.length <= right.length ? left : right;
  const longer = shorter === left ? right : left;
  const sharedPrefix = sharedPrefixLength(shorter, longer);

  if (sharedPrefix < 4) {
    return false;
  }

  const distance = levenshteinDistance(shorter, longer);

  return (
    isLikelyMorphologicalVariant(shorter, longer) ||
    distance <= 2 ||
    (distance <= 3 && hasVariantSuffix(shorter, longer))
  );
}

function canUseLexicalSimilarity(keyword: string) {
  return /^[a-z]+$/u.test(keyword) && keyword.length >= 5;
}

function sharedPrefixLength(left: string, right: string) {
  const maxLength = Math.min(left.length, right.length);
  let index = 0;

  while (index < maxLength && left[index] === right[index]) {
    index += 1;
  }

  return index;
}

function isLikelyMorphologicalVariant(shorter: string, longer: string) {
  if (longer.startsWith(shorter)) {
    return true;
  }

  const shorterStem = canonicalVariantStem(shorter);
  const longerStem = canonicalVariantStem(longer);

  if (shorterStem.length >= 4 && shorterStem === longerStem) {
    return true;
  }

  return false;
}

function canonicalVariantStem(keyword: string) {
  let stem = keyword;

  for (const suffix of ["ians", "ian", "ists", "ist", "ish", "ia", "ic", "al", "es", "s", "y"]) {
    if (stem.endsWith(suffix) && stem.length - suffix.length >= 4) {
      stem = stem.slice(0, -suffix.length);
      break;
    }
  }

  return stem;
}

function hasVariantSuffix(left: string, right: string) {
  return [left, right].some((keyword) =>
    ["ian", "ians", "ish", "ia", "y"].some(
      (suffix) => keyword.endsWith(suffix) && keyword.length - suffix.length >= 4,
    ),
  );
}

function levenshteinDistance(left: string, right: string) {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    let diagonal = previous[0];
    previous[0] = leftIndex;

    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const current = previous[rightIndex];
      const substitutionCost =
        left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;

      previous[rightIndex] = Math.min(
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + 1,
        diagonal + substitutionCost,
      );
      diagonal = current;
    }
  }

  return previous[right.length];
}
