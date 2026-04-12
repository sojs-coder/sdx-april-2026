"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useSentiment, type SentimentSignal } from "@/hooks/useSentiment";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

function SignalRow({ signal, index }: { signal: SentimentSignal; index: number }) {
  const isBullish = signal.direction === "bullish";
  const isBearish = signal.direction === "bearish";

  const dotColor = isBullish
    ? "bg-amber-500 shadow-[0_0_5px_rgba(245,158,11,0.6)]"
    : isBearish
    ? "bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.5)]"
    : "bg-zinc-700";

  const scoreColor = isBullish ? "text-amber-400" : isBearish ? "text-red-400" : "text-zinc-600";
  const Icon = isBullish ? TrendingUp : isBearish ? TrendingDown : Minus;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      transition={{ duration: 0.25 }}
      className={cn(
        "group flex items-start gap-2.5 px-3 py-2 rounded-lg hover:bg-white/3 transition-colors cursor-default",
        index === 0 && "bg-amber-500/3"
      )}
    >
      <div className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5", dotColor)} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold font-mono text-white/90">{signal.ticker}</span>
            <Icon className={cn("w-3 h-3", scoreColor)} />
            <span className={cn("text-[11px] font-mono", scoreColor)}>
              {signal.score > 0 ? "+" : ""}{signal.score.toFixed(2)}
            </span>
          </div>
          <span className="text-[10px] font-mono text-zinc-800 flex-shrink-0">
            {formatDistanceToNow(signal.timestamp, { addSuffix: false })}
          </span>
        </div>
        <p className="text-[11px] text-zinc-600 mt-0.5 leading-snug line-clamp-1 group-hover:text-zinc-500 transition-colors">
          {signal.message}
        </p>
      </div>
    </motion.div>
  );
}

export function SignalFeed() {
  const { signals, connected, metrics } = useSentiment({ interval: 2200, maxSignals: 30 });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/5 flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <div className={cn("w-1.5 h-1.5 rounded-full", connected ? "bg-amber-500" : "bg-zinc-700")} />
          <span className="text-xs font-medium text-white/80">Signals</span>
        </div>
        <span className="text-[10px] font-mono text-zinc-700">
          {metrics.bullishCount + metrics.bearishCount + metrics.neutralCount}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        <AnimatePresence initial={false} mode="popLayout">
          {signals.map((signal, i) => (
            <SignalRow key={signal.id} signal={signal} index={i} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
