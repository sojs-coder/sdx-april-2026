"use client";

import { useEffect, useState } from "react";
import type { TwitterTrendsResponse, TwitterTrendsState } from "@/lib/twitter-trends";

const DEFAULT_STATE: TwitterTrendsState = {
  trends: [],
  clusters: [],
  cached: false,
  fetchedAt: null,
  trendCount: 0,
  clusterCount: 0,
  windowPosts: 0,
  isLoading: true,
  error: null,
  connected: false,
};

export function useTwitterTrends(
  options: { interval?: number; limit?: number } = {},
) {
  const { interval = 45_000, limit = 8 } = options;
  const [state, setState] = useState<TwitterTrendsState>(DEFAULT_STATE);

  useEffect(() => {
    let cancelled = false;

    const fetchTrends = async (showLoader: boolean) => {
      if (showLoader) {
        setState((current) => ({ ...current, isLoading: true, error: null }));
      }

      try {
        const response = await fetch(`/api/twitter-trends?q=${limit}`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as
          | TwitterTrendsResponse
          | { error?: string };

        if (!response.ok) {
          throw new Error(
            "error" in payload && payload.error
              ? payload.error
              : "Unable to load live Twitter trends.",
          );
        }

        if (cancelled) {
          return;
        }

        const data = payload as TwitterTrendsResponse;
        setState({
          trends: data.trends,
          clusters: data.clusters,
          cached: data.cached,
          fetchedAt: data.fetched_at,
          trendCount: data.trend_count,
          clusterCount: data.cluster_count,
          windowPosts: data.window_posts,
          isLoading: false,
          error: null,
          connected: true,
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        setState((current) => ({
          ...current,
          isLoading: false,
          error:
            error instanceof Error
              ? error.message
              : "Unable to load live Twitter trends.",
        }));
      }
    };

    void fetchTrends(true);

    const timer = window.setInterval(() => {
      void fetchTrends(false);
    }, interval);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [interval, limit]);

  return state;
}
