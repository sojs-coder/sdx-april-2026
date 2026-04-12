"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useSentiment, type SentimentSignal } from "@/hooks/useSentiment";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

function SignalRow({ signal, index }: { signal: SentimentSignal; index: number }) {
  const isBullish = signal.direction === "bullish";
  const isBearish = signal.direction === "bearish";
  const dot   = isBullish ? "bg-amber-500 shadow-[0_0_4px_rgba(245,158,11,0.5)]"
              : isBearish ? "bg-red-500   shadow-[0_0_4px_rgba(239,68,68,0.4)]"
              : "bg-zinc-700";
  const score = isBullish ? "text-amber-400" : isBearish ? "text-red-400" : "text-zinc-600";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "flex items-start gap-2.5 px-3 py-2 hover:bg-white/3 transition-colors cursor-default",
        index === 0 && "bg-amber-500/3"
      )}
    >
      <div className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0 mt-[5px]", dot)} />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <div className="flex items-baseline gap-1.5">
            <span className="text-xs font-bold font-mono text-white/90">{signal.ticker}</span>
            <span className={cn("text-[11px] font-mono", score)}>
              {signal.score > 0 ? "+" : ""}{signal.score.toFixed(2)}
            </span>
          </div>
          <span className="text-[10px] font-mono text-zinc-800 flex-shrink-0">
            {formatDistanceToNow(signal.timestamp, { addSuffix: false })}
          </span>
        </div>
        <p className="text-[11px] text-zinc-700 mt-0.5 leading-snug line-clamp-1">
          {signal.message}
        </p>
      </div>
    </motion.div>
  );
}

export function SignalFeed() {
  const { signals } = useSentiment({ interval: 2200, maxSignals: 30 });

  return (
    <div className="h-full overflow-y-auto pt-1">
      <AnimatePresence initial={false} mode="popLayout">
        {signals.map((signal, i) => (
          <SignalRow key={signal.id} signal={signal} index={i} />
        ))}
      </AnimatePresence>
    </div>
  );
}
