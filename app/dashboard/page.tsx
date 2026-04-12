"use client";

import { HotTopics } from "@/components/dashboard/HotTopics";
import { BuildProcess } from "@/components/dashboard/BuildProcess";
import { useSentiment } from "@/hooks/useSentiment";
import { cn } from "@/lib/utils";

function Banner() {
  const { metrics, connected } = useSentiment({ interval: 2200 });
  const isBull = metrics.overallScore > 0.05;
  const isBear = metrics.overallScore < -0.05;
  const label =
    metrics.overallScore > 0.3 ? "EXTREME BULL" :
    isBull ? "BULLISH" :
    metrics.overallScore < -0.3 ? "EXTREME BEAR" :
    isBear ? "BEARISH" : "NEUTRAL";
  const color = isBull ? "text-amber-400" : isBear ? "text-red-400" : "text-zinc-600";
  const dot   = isBull ? "bg-amber-500"  : isBear ? "bg-red-500"   : "bg-zinc-700";

  return (
    <div className="flex items-center gap-3 px-4 py-1.5 border-b border-amber-500/8 text-[11px] font-mono">
      <div className={cn("flex items-center gap-1.5", color)}>
        <div className={cn("w-1.5 h-1.5 rounded-full", dot, connected && "animate-pulse")} />
        <span className="font-bold tracking-widest">{label}</span>
      </div>
      <span className="text-zinc-800">·</span>
      <span className={cn("tabular-nums", color)}>
        {metrics.overallScore > 0 ? "+" : ""}{(metrics.overallScore * 100).toFixed(2)}%
      </span>
      <div className="ml-auto text-zinc-800 tabular-nums">
        {new Date().toLocaleTimeString("en-US", { hour12: false })}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <div className="flex flex-col h-screen overflow-hidden pt-11">
      <Banner />
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-[3] min-w-0 border-r border-white/5 overflow-hidden">
          <HotTopics />
        </div>
        <div className="flex-[2] min-w-0 overflow-hidden">
          <BuildProcess />
        </div>
      </div>
    </div>
  );
}
