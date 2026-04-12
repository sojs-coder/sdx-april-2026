"use client";

import { motion } from "framer-motion";
import { SignalFeed } from "@/components/dashboard/SignalFeed";
import { ForgeCanvas } from "@/components/dashboard/ForgeCanvas";
import { AlphaMetrics } from "@/components/dashboard/AlphaMetrics";
import { useSentiment } from "@/hooks/useSentiment";
import { cn } from "@/lib/utils";

function SentimentRegimeBanner() {
  const { metrics, connected } = useSentiment({ interval: 2200 });

  const isBull = metrics.overallScore > 0.05;
  const isBear = metrics.overallScore < -0.05;
  const label = metrics.overallScore > 0.3 ? "EXTREME BULL" : isBull ? "BULLISH" : metrics.overallScore < -0.3 ? "EXTREME BEAR" : isBear ? "BEARISH" : "NEUTRAL";
  const color = isBull ? "text-amber-400" : isBear ? "text-red-400" : "text-zinc-600";

  return (
    <div className="flex items-center gap-3 px-3 py-1.5 border-b border-amber-500/8 text-[11px] font-mono bg-amber-500/3">
      <div className={cn("flex items-center gap-1.5", color)}>
        <div className={cn("w-1.5 h-1.5 rounded-full", connected ? "animate-pulse" : "", isBull ? "bg-amber-500" : isBear ? "bg-red-500" : "bg-zinc-700")} />
        <span className="font-bold tracking-widest">{label}</span>
      </div>
      <span className="text-zinc-800">·</span>
      <span className={cn("tabular-nums", color)}>
        {metrics.overallScore > 0 ? "+" : ""}{(metrics.overallScore * 100).toFixed(2)}%
      </span>
      <span className="text-zinc-800">·</span>
      <span className="text-zinc-700">{metrics.bullishCount}B / {metrics.bearishCount}S</span>
      <span className="text-zinc-800">·</span>
      <span className="text-zinc-700">{metrics.dominantTicker}</span>
      <div className="ml-auto text-zinc-800">
        {new Date().toLocaleTimeString("en-US", { hour12: false })}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <div className="flex flex-col h-screen overflow-hidden pt-12">
      {/* Top regime banner */}
      <SentimentRegimeBanner />

      {/* 3-pane layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Left pane: Signal Feed ── */}
        <motion.div
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="w-72 flex-shrink-0 border-r border-white/6 flex flex-col overflow-hidden"
        >
          <SignalFeed />
        </motion.div>

        {/* ── Center pane: Forge Canvas ── */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="flex-1 flex flex-col overflow-hidden min-w-0"
        >
          <ForgeCanvas />
        </motion.div>

        {/* ── Right pane: Alpha Metrics ── */}
        <motion.div
          initial={{ x: 20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          className="w-64 flex-shrink-0 border-l border-white/6 flex flex-col overflow-hidden"
        >
          <AlphaMetrics />
        </motion.div>
      </div>
    </div>
  );
}
