"use client";

import { useEffect, useState } from "react";
import type { TwitterTrendsResponse, TwitterTrendsState } from "@/lib/twitter-trends";

type CachedTrendState = Omit<TwitterTrendsState, "isLoading" | "error"> & {
  savedAt: number;
};

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

const CLIENT_CACHE_TTL_MS = 5 * 60 * 1000;
const memoryCache = new Map<number, CachedTrendState>();

export function useTwitterTrends(
  options: { interval?: number; limit?: number } = {},
) {
  const { interval = 45_000, limit = 8 } = options;
  const [state, setState] = useState<TwitterTrendsState>(DEFAULT_STATE);

  useEffect(() => {
    let cancelled = false;

    const hydrateFromCache = () => {
      const cachedState = readTrendStateCache(limit);

      if (!cachedState) {
        return false;
      }

      setState({
        trends: cachedState.trends,
        clusters: cachedState.clusters,
        cached: cachedState.cached,
        fetchedAt: cachedState.fetchedAt,
        trendCount: cachedState.trendCount,
        clusterCount: cachedState.clusterCount,
        windowPosts: cachedState.windowPosts,
        isLoading: true,
        error: null,
        connected: cachedState.connected,
      });

      return true;
    };

    const fetchTrends = async (showLoader: boolean) => {
      if (showLoader) {
        const hydrated = hydrateFromCache();

        if (!hydrated) {
          setState((current) => ({ ...current, isLoading: true, error: null }));
        }
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
        const nextState = {
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
        } satisfies TwitterTrendsState;

        writeTrendStateCache(limit, nextState);
        setState(nextState);
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

function readTrendStateCache(limit: number) {
  const cachedMemoryState = memoryCache.get(limit);
  if (cachedMemoryState && !isExpired(cachedMemoryState.savedAt)) {
    return cachedMemoryState;
  }

  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(getStorageKey(limit));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as CachedTrendState;
    if (!parsed || isExpired(parsed.savedAt)) {
      window.sessionStorage.removeItem(getStorageKey(limit));
      memoryCache.delete(limit);
      return null;
    }

    memoryCache.set(limit, parsed);
    return parsed;
  } catch {
    return null;
  }
}

function writeTrendStateCache(limit: number, state: TwitterTrendsState) {
  const cachedState: CachedTrendState = {
    trends: state.trends,
    clusters: state.clusters,
    cached: state.cached,
    fetchedAt: state.fetchedAt,
    trendCount: state.trendCount,
    clusterCount: state.clusterCount,
    windowPosts: state.windowPosts,
    connected: state.connected,
    savedAt: Date.now(),
  };

  memoryCache.set(limit, cachedState);

  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(
      getStorageKey(limit),
      JSON.stringify(cachedState),
    );
  } catch {}
}

function getStorageKey(limit: number) {
  return `twitter-trends:${limit}`;
}

function isExpired(savedAt: number) {
  return Date.now() - savedAt > CLIENT_CACHE_TTL_MS;
}
