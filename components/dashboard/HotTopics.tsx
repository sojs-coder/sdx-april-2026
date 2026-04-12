"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Hash, RadioTower, WifiOff } from "lucide-react";
import type { TwitterTrend } from "@/lib/twitter-trends";
import { formatCompactNumber, formatFetchedAtLabel } from "@/lib/twitter-trends";
import { cn } from "@/lib/utils";

function HeatBar({ score, maxScore }: { score: number; maxScore: number }) {
  const heat = maxScore > 0 ? Math.max(0.08, score / maxScore) : 0;

  return (
    <div className="h-1 w-24 overflow-hidden rounded-full bg-white/5">
      <motion.div
        className="h-full w-full origin-left rounded-full bg-amber-500"
        animate={{ scaleX: heat }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      />
    </div>
  );
}

function TopicRow({
  trend,
  rank,
  maxScore,
}: {
  trend: TwitterTrend;
  rank: number;
  maxScore: number;
}) {
  const tags = trend.representative_hashtags.slice(0, 2);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className={cn(
        "group grid items-center gap-4 border-b border-white/4 px-5 py-3.5 transition-colors",
        "hover:bg-white/3",
        rank === 1 && "bg-amber-500/4",
      )}
      style={{ gridTemplateColumns: "2rem 7rem 1fr auto auto" }}
    >
      <span
        className={cn(
          "text-sm font-mono font-bold tabular-nums",
          rank === 1 ? "text-amber-500" : rank <= 3 ? "text-amber-500/50" : "text-zinc-800",
        )}
      >
        {String(rank).padStart(2, "0")}
      </span>

      <span
        className={cn(
          "truncate text-sm font-bold tracking-wide",
          rank === 1 ? "text-white" : "text-white/80",
        )}
        title={trend.trend}
      >
        {trend.trend}
      </span>

      <div className="flex min-w-0 items-center gap-3">
        <HeatBar score={trend.trend_score} maxScore={maxScore} />
        <div className="flex min-w-0 items-center gap-1.5 text-[10px] font-mono text-zinc-700">
          {tags.length > 0 ? (
            <>
              <Hash className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{tags.join(" ")}</span>
            </>
          ) : (
            <span className="truncate text-zinc-800">keyword cluster</span>
          )}
        </div>
      </div>

      <div className="text-sm font-semibold tabular-nums text-amber-400">
        {formatCompactNumber(trend.trend_score)}
      </div>

      <span className="w-12 text-right text-[11px] font-mono text-zinc-700">
        {formatCompactNumber(trend.post_count)}
        <span className="ml-0.5 text-zinc-800">vol</span>
      </span>
    </motion.div>
  );
}

type HotTopicsProps = {
  trends: TwitterTrend[];
  cached: boolean;
  fetchedAt: string | null;
  isLoading: boolean;
  error: string | null;
  connected: boolean;
};

export function HotTopics({
  trends,
  cached,
  fetchedAt,
  isLoading,
  error,
  connected,
}: HotTopicsProps) {
  const maxScore = trends[0]?.trend_score ?? 0;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div
        className="grid flex-shrink-0 items-center gap-4 border-b border-white/6 px-5 py-2"
        style={{ gridTemplateColumns: "2rem 7rem 1fr auto auto" }}
      >
        <span className="text-[10px] font-mono text-zinc-800">#</span>
        <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-700">Trend</span>
        <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-700">Momentum</span>
        <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-700">Posts/hr</span>
        <span className="text-right text-[10px] font-mono uppercase tracking-widest text-zinc-700">Vol</span>
      </div>

      <div className="flex items-center gap-2 border-b border-white/4 px-5 py-2 text-[10px] font-mono uppercase tracking-[0.24em] text-zinc-700">
        {connected ? (
          <RadioTower className={cn("h-3 w-3", cached ? "text-zinc-500" : "text-amber-500")} />
        ) : (
          <WifiOff className="h-3 w-3 text-zinc-700" />
        )}
        <span className={cached ? "text-zinc-500" : connected ? "text-amber-400/80" : "text-zinc-700"}>
          {cached ? "cached relay" : connected ? "live twitter relay" : "waiting for relay"}
        </span>
        <span className="ml-auto tracking-normal text-zinc-800">{formatFetchedAtLabel(fetchedAt)}</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="popLayout" initial={false}>
          {trends.map((trend, index) => (
            <TopicRow key={trend.trend} trend={trend} rank={index + 1} maxScore={maxScore} />
          ))}
        </AnimatePresence>

        {isLoading && trends.length === 0 && (
          <div className="flex h-32 items-center justify-center text-xs font-mono text-zinc-800">
            syncing live trend extraction...
          </div>
        )}

        {!isLoading && error && trends.length === 0 && (
          <div className="flex h-32 items-center justify-center px-8 text-center text-xs font-mono text-red-400/80">
            {error}
          </div>
        )}

        {!isLoading && !error && trends.length === 0 && (
          <div className="flex h-32 items-center justify-center text-xs font-mono text-zinc-800">
            no trends returned from extractor
          </div>
        )}
      </div>
    </div>
  );
}
