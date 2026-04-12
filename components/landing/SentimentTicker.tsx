"use client";

import { useSentiment } from "@/hooks/useSentiment";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

export function SentimentTicker() {
  const { signals } = useSentiment({ interval: 3000, maxSignals: 16 });
  const items = [...signals, ...signals];

  return (
    <div className="relative w-full overflow-hidden border-y border-amber-500/8 py-2 bg-[#0C0A08]">
      <div className="absolute left-0 top-0 bottom-0 w-12 z-10 bg-gradient-to-r from-[#0C0A08] to-transparent pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-12 z-10 bg-gradient-to-l from-[#0C0A08] to-transparent pointer-events-none" />

      <div className="flex animate-marquee gap-2 whitespace-nowrap" style={{ width: "max-content" }}>
        {items.map((signal, i) => {
          const isBullish = signal.direction === "bullish";
          const isBearish = signal.direction === "bearish";
          const Icon = isBullish ? TrendingUp : isBearish ? TrendingDown : Minus;
          return (
            <div
              key={`${signal.id}-${i}`}
              className={cn(
                "inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono",
                isBullish ? "text-amber-400" : isBearish ? "text-red-400" : "text-zinc-600"
              )}
            >
              <Icon className="w-2.5 h-2.5" />
              <span className="font-bold text-white/80">{signal.ticker}</span>
              <span>{signal.score > 0 ? "+" : ""}{signal.score.toFixed(2)}</span>
              <span className="text-zinc-800 mx-1">·</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
