"use client";

import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useSentiment } from "@/hooks/useSentiment";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";

interface Topic {
  ticker: string;
  score: number;
  count: number;
  bullish: number;
  bearish: number;
  direction: "bullish" | "bearish" | "neutral";
  heat: number; // 0–1
}

function useHotTopics(): Topic[] {
  const { signals } = useSentiment({ interval: 2200, maxSignals: 60 });

  return useMemo(() => {
    const map: Record<string, { scoreSum: number; count: number; bullish: number; bearish: number }> = {};
    for (const s of signals) {
      if (!map[s.ticker]) map[s.ticker] = { scoreSum: 0, count: 0, bullish: 0, bearish: 0 };
      map[s.ticker].scoreSum += s.score;
      map[s.ticker].count++;
      if (s.direction === "bullish") map[s.ticker].bullish++;
      else if (s.direction === "bearish") map[s.ticker].bearish++;
    }
    const topics = Object.entries(map).map(([ticker, d]) => {
      const score = d.scoreSum / d.count;
      return {
        ticker,
        score,
        count: d.count,
        bullish: d.bullish,
        bearish: d.bearish,
        direction: (score > 0.08 ? "bullish" : score < -0.08 ? "bearish" : "neutral") as Topic["direction"],
        heat: Math.min(1, d.count / 12),
      };
    });
    return topics.sort((a, b) => b.heat * Math.abs(b.score) - a.heat * Math.abs(a.score)).slice(0, 8);
  }, [signals]);
}

function HeatBar({ heat, direction }: { heat: number; direction: Topic["direction"] }) {
  const fill = direction === "bullish" ? "bg-amber-500" : direction === "bearish" ? "bg-red-500" : "bg-zinc-600";
  return (
    <div className="w-24 h-1 bg-white/5 rounded-full overflow-hidden">
      <motion.div
        className={cn("h-full w-full rounded-full origin-left", fill)}
        animate={{ scaleX: heat }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      />
    </div>
  );
}

function TopicRow({ topic, rank }: { topic: Topic; rank: number }) {
  const isBull = topic.direction === "bullish";
  const isBear = topic.direction === "bearish";
  const scoreColor = isBull ? "text-amber-400" : isBear ? "text-red-400" : "text-zinc-600";
  const Icon = isBull ? TrendingUp : isBear ? TrendingDown : null;

  return (
    <Link href={`/dashboard/${topic.ticker.toLowerCase()}`} className="block">
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className={cn(
        "group grid items-center gap-4 px-5 py-3.5 transition-colors cursor-pointer",
        "hover:bg-white/[0.04] border-b border-white/4",
        rank === 1 && "bg-amber-500/4"
      )}
      style={{ gridTemplateColumns: "2rem 5rem 1fr auto auto" }}
    >
      {/* Rank */}
      <span className={cn(
        "text-sm font-mono font-bold tabular-nums",
        rank === 1 ? "text-amber-500" : rank <= 3 ? "text-amber-500/50" : "text-zinc-800"
      )}>
        {String(rank).padStart(2, "0")}
      </span>

      {/* Ticker */}
      <span className={cn(
        "text-sm font-bold tracking-wide",
        rank === 1 ? "text-white" : "text-white/80"
      )}>
        {topic.ticker}
      </span>

      {/* Heat bar */}
      <HeatBar heat={topic.heat} direction={topic.direction} />

      {/* Score */}
      <div className={cn("flex items-center gap-1 font-mono text-sm font-semibold tabular-nums", scoreColor)}>
        {Icon && <Icon className="w-3 h-3" />}
        {topic.score > 0 ? "+" : ""}{(topic.score * 100).toFixed(0)}
      </div>

      {/* Signal count */}
      <span className="text-[11px] font-mono text-zinc-700 text-right w-12">
        {topic.count}<span className="text-zinc-800 ml-0.5">sig</span>
      </span>
    </motion.div>
    </Link>
  );
}

export function HotTopics() {
  const topics = useHotTopics();

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Column headers */}
      <div
        className="grid items-center gap-4 px-5 py-2 border-b border-white/6 flex-shrink-0"
        style={{ gridTemplateColumns: "2rem 5rem 1fr auto auto" }}
      >
        <span className="text-[10px] font-mono text-zinc-800">#</span>
        <span className="text-[10px] font-mono text-zinc-700 uppercase tracking-widest">Space</span>
        <span className="text-[10px] font-mono text-zinc-700 uppercase tracking-widest">Heat</span>
        <span className="text-[10px] font-mono text-zinc-700 uppercase tracking-widest">Score</span>
        <span className="text-[10px] font-mono text-zinc-700 uppercase tracking-widest text-right">Vol</span>
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="popLayout" initial={false}>
          {topics.map((topic, i) => (
            <TopicRow key={topic.ticker} topic={topic} rank={i + 1} />
          ))}
        </AnimatePresence>

        {topics.length === 0 && (
          <div className="flex items-center justify-center h-32 text-xs font-mono text-zinc-800">
            collecting signals…
          </div>
        )}
      </div>
    </div>
  );
}
