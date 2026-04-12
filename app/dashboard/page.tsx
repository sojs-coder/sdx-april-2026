"use client";

import { BuildProcess } from "@/components/dashboard/BuildProcess";
import { HotTopics } from "@/components/dashboard/HotTopics";
import { useTwitterTrends } from "@/hooks/useTwitterTrends";
import { formatCompactNumber, formatFetchedAtLabel } from "@/lib/twitter-trends";
import { cn } from "@/lib/utils";

function Banner({
  connected,
  cached,
  error,
  fetchedAt,
  topTrend,
}: {
  connected: boolean;
  cached: boolean;
  error: string | null;
  fetchedAt: string | null;
  topTrend: {
    trend: string;
    post_count: number;
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
        {topTrend ? `${topTrend.trend} ${formatCompactNumber(topTrend.post_count)}/hr` : error ?? "waiting for trend stream"}
      </span>
      <div className="ml-auto tabular-nums text-zinc-800">{formatFetchedAtLabel(fetchedAt)}</div>
    </div>
  );
}

export default function DashboardPage() {
  const trendStream = useTwitterTrends({ interval: 45_000, limit: 8 });

  return (
    <div className="flex h-screen flex-col overflow-hidden pt-11">
      <Banner
        connected={trendStream.connected}
        cached={trendStream.cached}
        error={trendStream.error}
        fetchedAt={trendStream.fetchedAt}
        topTrend={trendStream.trends[0] ?? null}
      />
      <div className="flex flex-1 overflow-hidden">
        <div className="min-w-0 flex-[3] overflow-hidden border-r border-white/5">
          <HotTopics {...trendStream} />
        </div>
        <div className="min-w-0 flex-[2] overflow-hidden">
          <BuildProcess
            connected={trendStream.connected}
            trends={trendStream.trends}
            isLoading={trendStream.isLoading}
          />
        </div>
      </div>
    </div>
  );
}
