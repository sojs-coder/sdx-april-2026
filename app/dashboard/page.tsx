"use client";

import { BuildProcess } from "@/components/dashboard/BuildProcess";
import { HotTopics } from "@/components/dashboard/HotTopics";
import { useTwitterTrends } from "@/hooks/useTwitterTrends";
import {
  DASHBOARD_TRENDS_LIMIT,
  displayKeyword,
  formatCompactNumber,
  formatFetchedAtLabel,
} from "@/lib/twitter-trends";
import { cn } from "@/lib/utils";

function Banner({
  connected,
  cached,
  error,
  fetchedAt,
  topCluster,
}: {
  connected: boolean;
  cached: boolean;
  error: string | null;
  fetchedAt: string | null;
  topCluster: {
    keyword: string;
    totalPosts: number;
  } | null;
}) {
  const label = error && !connected ? "OFFLINE" : cached ? "CACHED" : connected ? "LIVE" : "SYNCING";
  const color =
    error && !connected
      ? "text-red-400"
      : cached
        ? "text-zinc-400"
        : "text-amber-400";
  const dot =
    error && !connected
      ? "bg-red-500"
      : cached
        ? "bg-zinc-500"
        : "bg-amber-500";

  return (
    <div className="flex items-center gap-3 border-b border-amber-500/8 px-4 py-1.5 text-[11px] font-mono">
      <div className={cn("flex items-center gap-1.5", color)}>
        <div className={cn("h-1.5 w-1.5 rounded-full", dot, connected && "animate-pulse")} />
        <span className="font-bold tracking-widest">{label}</span>
      </div>
      <span className="text-zinc-800">|</span>
      <span className={cn("tabular-nums", color)}>
        {topCluster
          ? `${displayKeyword(topCluster.keyword)} ${formatCompactNumber(topCluster.totalPosts)}/hr`
          : error ?? "waiting for cluster stream"}
      </span>
      <div className="ml-auto tabular-nums text-zinc-800">{formatFetchedAtLabel(fetchedAt)}</div>
    </div>
  );
}

function OverviewRail({
  trendCount,
  clusterCount,
  windowPosts,
  topCluster,
  topTrend,
}: {
  trendCount: number;
  clusterCount: number;
  windowPosts: number;
  topCluster: string;
  topTrend: string;
}) {
  const cells = [
    { label: "window trends", value: String(trendCount) },
    { label: "keyword clusters", value: String(clusterCount) },
    { label: "window volume", value: `${formatCompactNumber(windowPosts)}/hr` },
    { label: "dominant cluster", value: topCluster || "--" },
    { label: "lead trend", value: topTrend || "--" },
  ];

  return (
    <div className="grid grid-cols-5 border-b border-white/5 bg-[linear-gradient(90deg,rgba(245,158,11,0.06),transparent_38%,transparent)]">
      {cells.map((cell) => (
        <div key={cell.label} className="border-r border-white/5 px-4 py-3 last:border-r-0">
          <div className="text-[10px] font-mono uppercase tracking-[0.24em] text-zinc-700">
            {cell.label}
          </div>
          <div className="mt-1 truncate text-sm font-semibold text-white">
            {cell.value}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const trendStream = useTwitterTrends({
    interval: 45_000,
    limit: DASHBOARD_TRENDS_LIMIT,
  });
  const topCluster = trendStream.clusters[0] ?? null;

  return (
    <div className="flex h-screen flex-col overflow-hidden pt-11">
      <Banner
        connected={trendStream.connected}
        cached={trendStream.cached}
        error={trendStream.error}
        fetchedAt={trendStream.fetchedAt}
        topCluster={
          topCluster
            ? { keyword: topCluster.keyword, totalPosts: topCluster.totalPosts }
            : null
        }
      />
      <OverviewRail
        trendCount={trendStream.trendCount}
        clusterCount={trendStream.clusterCount}
        windowPosts={trendStream.windowPosts}
        topCluster={topCluster ? displayKeyword(topCluster.keyword) : "--"}
        topTrend={topCluster?.leadTrend.trend ?? "--"}
      />
      <div className="flex flex-1 overflow-hidden">
        <div className="min-w-0 flex-[3.35] overflow-hidden border-r border-white/5">
          <HotTopics
            clusters={trendStream.clusters}
            trendCount={trendStream.trendCount}
            clusterCount={trendStream.clusterCount}
            windowPosts={trendStream.windowPosts}
            cached={trendStream.cached}
            fetchedAt={trendStream.fetchedAt}
            isLoading={trendStream.isLoading}
            error={trendStream.error}
            connected={trendStream.connected}
          />
        </div>
        <div className="min-w-0 flex-[1.95] overflow-hidden">
          <BuildProcess
            connected={trendStream.connected}
            trends={trendStream.trends}
            isLoading={trendStream.isLoading}
            selectedTrend={topCluster?.leadTrend ?? null}
          />
        </div>
      </div>
    </div>
  );
}
