"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Hash, Layers3, RadioTower, WifiOff } from "lucide-react";
import type { KeywordCluster } from "@/lib/twitter-trends";
import {
  displayKeyword,
  formatCompactNumber,
  formatFetchedAtLabel,
  formatPercent,
} from "@/lib/twitter-trends";
import { cn } from "@/lib/utils";

function MomentumBar({
  shareOfWindow,
  maxShare,
}: {
  shareOfWindow: number;
  maxShare: number;
}) {
  const scale = maxShare > 0 ? Math.max(0.08, shareOfWindow / maxShare) : 0;

  return (
    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/5">
      <motion.div
        className="h-full w-full origin-left rounded-full bg-amber-500"
        animate={{ scaleX: scale }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      />
    </div>
  );
}

function ClusterRow({
  cluster,
  rank,
  maxShare,
}: {
  cluster: KeywordCluster;
  rank: number;
  maxShare: number;
}) {
  return (
    <Link href={`/dashboard/${cluster.slug}`} className="block">
      <motion.div
        layout
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className={cn(
          "group grid cursor-pointer items-center gap-4 border-b border-white/4 px-5 py-3 transition-colors",
          "hover:bg-white/[0.04]",
          rank <= 2 && "bg-amber-500/[0.035]",
        )}
        style={{ gridTemplateColumns: "2rem 8rem 1.35fr 7rem 5rem 5rem" }}
      >
        <span
          className={cn(
            "text-sm font-mono font-bold tabular-nums",
            rank === 1 ? "text-amber-500" : rank <= 3 ? "text-amber-500/60" : "text-zinc-800",
          )}
        >
          {String(rank).padStart(2, "0")}
        </span>

        <div className="min-w-0">
          <div className="truncate text-sm font-semibold tracking-wide text-white">
            {displayKeyword(cluster.keyword)}
          </div>
          <div className="mt-1 flex items-center gap-1 text-[10px] font-mono text-zinc-700">
            <Layers3 className="h-3 w-3" />
            {cluster.memberCount} members
          </div>
        </div>

        <div className="min-w-0">
          <div className="truncate text-[12px] font-medium text-white/85">
            {cluster.leadTrend.trend}
          </div>
          <div className="mt-1 flex min-w-0 items-center gap-1.5 text-[10px] font-mono text-zinc-700">
            {cluster.hashtags.length > 0 ? (
              <>
                <Hash className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">{cluster.hashtags.slice(0, 3).join(" ")}</span>
              </>
            ) : (
              <span className="truncate text-zinc-800">derived from lexical overlap</span>
            )}
          </div>
        </div>

        <div className="min-w-0">
          <MomentumBar shareOfWindow={cluster.shareOfWindow} maxShare={maxShare} />
          <div className="mt-1 text-[10px] font-mono text-zinc-700">
            {formatPercent(cluster.shareOfWindow)} of live window
          </div>
        </div>

        <div className="text-right text-sm font-semibold tabular-nums text-amber-400">
          {formatCompactNumber(cluster.totalPosts)}
        </div>

        <div className="text-right text-[11px] font-mono text-zinc-600">
          {cluster.hashtags.length}
          <span className="ml-0.5 text-zinc-800">tags</span>
        </div>
      </motion.div>
    </Link>
  );
}

function DensityStrip({
  clusterCount,
  trendsCount,
  totalPosts,
}: {
  clusterCount: number;
  trendsCount: number;
  totalPosts: number;
}) {
  const cells = [
    { label: "clusters", value: String(clusterCount) },
    { label: "raw trends", value: String(trendsCount) },
    { label: "combined reach", value: formatCompactNumber(totalPosts) },
  ];

  return (
    <div className="grid grid-cols-3 border-b border-white/4">
      {cells.map((cell) => (
        <div key={cell.label} className="border-r border-white/4 px-5 py-2 last:border-r-0">
          <div className="text-[10px] font-mono uppercase tracking-[0.24em] text-zinc-700">
            {cell.label}
          </div>
          <div className="mt-1 text-sm font-semibold text-white">
            {cell.value}
          </div>
        </div>
      ))}
    </div>
  );
}

type HotTopicsProps = {
  clusters: KeywordCluster[];
  trendCount: number;
  clusterCount: number;
  windowPosts: number;
  cached: boolean;
  fetchedAt: string | null;
  isLoading: boolean;
  error: string | null;
  connected: boolean;
};

export function HotTopics({
  clusters,
  trendCount,
  clusterCount,
  windowPosts,
  cached,
  fetchedAt,
  isLoading,
  error,
  connected,
}: HotTopicsProps) {
  const maxShare = clusters[0]?.shareOfWindow ?? 0;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div
        className="grid flex-shrink-0 items-center gap-4 border-b border-white/6 px-5 py-2"
        style={{ gridTemplateColumns: "2rem 8rem 1.35fr 7rem 5rem 5rem" }}
      >
        <span className="text-[10px] font-mono text-zinc-800">#</span>
        <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-700">Cluster</span>
        <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-700">Lead Signal</span>
        <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-700">Window Share</span>
        <span className="text-right text-[10px] font-mono uppercase tracking-widest text-zinc-700">Volume</span>
        <span className="text-right text-[10px] font-mono uppercase tracking-widest text-zinc-700">Tags</span>
      </div>

      <div className="flex items-center gap-2 border-b border-white/4 px-5 py-2 text-[10px] font-mono uppercase tracking-[0.24em] text-zinc-700">
        {connected ? (
          <RadioTower className={cn("h-3 w-3", cached ? "text-zinc-500" : "text-amber-500")} />
        ) : (
          <WifiOff className="h-3 w-3 text-zinc-700" />
        )}
        <span className={cached ? "text-zinc-500" : connected ? "text-amber-400/80" : "text-zinc-700"}>
          {cached ? "cached relay" : connected ? "live keyword cluster ledger" : "waiting for relay"}
        </span>
        <span className="ml-auto tracking-normal text-zinc-800">{formatFetchedAtLabel(fetchedAt)}</span>
      </div>

      <DensityStrip
        clusterCount={clusterCount}
        trendsCount={trendCount}
        totalPosts={windowPosts}
      />

      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="popLayout" initial={false}>
          {clusters.map((cluster, index) => (
            <ClusterRow
              key={cluster.slug}
              cluster={cluster}
              rank={index + 1}
              maxShare={maxShare}
            />
          ))}
        </AnimatePresence>

        {isLoading && clusters.length === 0 && (
          <div className="flex h-32 items-center justify-center text-xs font-mono text-zinc-800">
            assembling keyword clusters...
          </div>
        )}

        {!isLoading && error && clusters.length === 0 && (
          <div className="flex h-32 items-center justify-center px-8 text-center text-xs font-mono text-red-400/80">
            {error}
          </div>
        )}

        {!isLoading && !error && clusters.length === 0 && (
          <div className="flex h-32 items-center justify-center text-xs font-mono text-zinc-800">
            no clusters available in the current live window
          </div>
        )}
      </div>
    </div>
  );
}
