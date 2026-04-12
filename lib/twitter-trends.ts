export interface TwitterTrend {
  trend: string;
  trend_score: number;
  post_count: number;
  representative_hashtags: string[];
}

export interface TwitterTrendsResponse {
  trends: TwitterTrend[];
  cached: boolean;
  fetched_at: string;
}

export interface TwitterTrendsState {
  trends: TwitterTrend[];
  cached: boolean;
  fetchedAt: string | null;
  isLoading: boolean;
  error: string | null;
  connected: boolean;
}

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

export function trendSlug(trend: string) {
  return (
    trend
      .replace(/^#/, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "trend"
  );
}

function trimDecimal(value: number) {
  return value.toFixed(1).replace(/\.0$/, "");
}
