"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Hash, RadioTower, WifiOff } from "lucide-react";
import { BuildProcess } from "@/components/dashboard/BuildProcess";
import { useTwitterTrends } from "@/hooks/useTwitterTrends";
import {
  DASHBOARD_TRENDS_LIMIT,
  displayKeyword,
  findKeywordCluster,
  formatCompactNumber,
  formatFetchedAtLabel,
  formatPercent,
  getRelatedKeywordClusters,
} from "@/lib/twitter-trends";
import { cn } from "@/lib/utils";

function MetricBlock({
  label,
  value,
  accent = "text-white",
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="rounded-lg border border-white/6 bg-white/[0.015] px-4 py-3">
      <div className="text-[10px] font-mono uppercase tracking-[0.24em] text-zinc-700">
        {label}
      </div>
      <div className={cn("mt-1 text-sm font-semibold", accent)}>{value}</div>
    </div>
  );
}

export default function SpacePage() {
  const params = useParams<{ space: string }>();
  const slug = params.space ?? "";
  const trendStream = useTwitterTrends({
    interval: 45_000,
    limit: DASHBOARD_TRENDS_LIMIT,
  });
  const selectedCluster = useMemo(
    () => findKeywordCluster(trendStream.clusters, slug),
    [trendStream.clusters, slug],
  );
  const relatedClusters = useMemo(
    () => getRelatedKeywordClusters(trendStream.clusters, selectedCluster),
    [trendStream.clusters, selectedCluster],
  );

  return (
    <div className="flex h-screen flex-col overflow-hidden pt-11">
      <div className="flex flex-shrink-0 items-center gap-3 border-b border-amber-500/8 px-4 py-1.5 text-[11px] font-mono">
        <Link
          href="/dashboard"
          className="flex items-center gap-1.5 text-zinc-700 transition-colors hover:text-zinc-400"
        >
          <ArrowLeft className="h-3 w-3" />
          clusters
        </Link>
        <span className="text-zinc-800">|</span>
        <span className="truncate text-white/60">
          {selectedCluster ? displayKeyword(selectedCluster.keyword) : slug}
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          {trendStream.connected ? (
            <RadioTower className={cn("h-3 w-3", trendStream.cached ? "text-zinc-500" : "text-amber-500")} />
          ) : (
            <WifiOff className="h-3 w-3 text-zinc-700" />
          )}
          <span className={trendStream.connected ? "text-amber-400/80" : "text-zinc-700"}>
            {formatFetchedAtLabel(trendStream.fetchedAt)}
          </span>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="min-w-0 flex-[3.2] overflow-y-auto border-r border-white/5">
          <div className="mx-auto flex max-w-[980px] flex-col gap-6 px-6 py-6">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="rounded-2xl border border-amber-500/12 bg-[linear-gradient(135deg,rgba(245,158,11,0.08),rgba(12,10,8,0.2)_42%,rgba(255,255,255,0.02))] p-6"
            >
              <div className="flex items-start justify-between gap-6">
                <div className="min-w-0">
                  <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-amber-500/60">
                    keyword cluster
                  </div>
                  <h1 className="mt-3 truncate text-4xl font-bold tracking-tight text-white">
                    {selectedCluster
                      ? displayKeyword(selectedCluster.keyword)
                      : "Cluster unavailable"}
                  </h1>
                  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
                    {selectedCluster
                      ? selectedCluster.mergeStrategy === "semantic"
                        ? `This cluster groups live trends that a contextual event-resolution pass judged to be about the same story: "${selectedCluster.keyword}". Use it to inspect adjacent narratives and shared reach beyond raw lexical overlap.`
                        : `This cluster groups every live trend in the current window that shares the "${selectedCluster.keyword}" keyword signal. Use it to inspect adjacent narratives, hashtag overlap, and total reachable volume before spinning up a build.`
                      : "This cluster is no longer present in the active live window. The full cluster ledger below is still available."}
                  </p>
                  {selectedCluster?.mergeStrategy === "semantic" && selectedCluster.mergeReason && (
                    <div className="mt-3 max-w-2xl rounded-xl border border-amber-500/15 bg-amber-500/[0.04] px-3 py-2 text-xs text-amber-100/70">
                      {selectedCluster.mergeReason}
                      {typeof selectedCluster.mergeConfidence === "number" && (
                        <span className="ml-2 font-mono text-amber-400/80">
                          {Math.round(selectedCluster.mergeConfidence * 100)}% confidence
                        </span>
                      )}
                    </div>
                  )}
                </div>
                {selectedCluster && (
                  <div className="min-w-[180px] rounded-xl border border-white/8 bg-black/20 p-4">
                    <div className="text-[10px] font-mono uppercase tracking-[0.24em] text-zinc-700">
                      window concentration
                    </div>
                    <div className="mt-2 text-2xl font-bold text-amber-400">
                      {formatPercent(selectedCluster.shareOfWindow)}
                    </div>
                    <div className="mt-1 text-xs text-zinc-500">
                      {formatCompactNumber(selectedCluster.totalPosts)} of {formatCompactNumber(trendStream.windowPosts)} posts/hr
                    </div>
                  </div>
                )}
              </div>

              {selectedCluster && (
                <div className="mt-6 grid grid-cols-4 gap-3">
                  <MetricBlock
                    label="member trends"
                    value={String(selectedCluster.memberCount)}
                  />
                  <MetricBlock
                    label="cluster volume"
                    value={`${formatCompactNumber(selectedCluster.totalPosts)}/hr`}
                    accent="text-amber-400"
                  />
                  <MetricBlock
                    label="lead signal"
                    value={selectedCluster.leadTrend.trend}
                  />
                  <MetricBlock
                    label="hashtags"
                    value={String(selectedCluster.hashtags.length)}
                  />
                </div>
              )}
            </motion.div>

            <section className="rounded-2xl border border-white/6 bg-white/[0.015]">
              <div className="flex items-center justify-between border-b border-white/6 px-5 py-3">
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-[0.24em] text-zinc-700">
                    Cluster members
                  </div>
                  <div className="mt-1 text-sm text-zinc-500">
                    {selectedCluster?.mergeStrategy === "semantic"
                      ? "Every live trend currently mapped to this contextual event cluster."
                      : "Every live trend currently mapped to this keyword."}
                  </div>
                </div>
                {selectedCluster && (
                  <div className="flex flex-wrap justify-end gap-2">
                    {selectedCluster.hashtags.length > 0 ? (
                      selectedCluster.hashtags.map((tag) => (
                        <div
                          key={tag}
                          className="inline-flex items-center gap-1 rounded-full border border-white/8 px-2.5 py-1 text-[10px] font-mono text-zinc-500"
                        >
                          <Hash className="h-3 w-3" />
                          {tag}
                        </div>
                      ))
                    ) : (
                      <div className="text-xs font-mono text-zinc-700">
                        no representative hashtags
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-[2rem_1.4fr_6rem_6rem_1fr] gap-4 border-b border-white/6 px-5 py-2 text-[10px] font-mono uppercase tracking-widest text-zinc-700">
                <span>#</span>
                <span>Trend</span>
                <span className="text-right">Posts/hr</span>
                <span className="text-right">Share</span>
                <span>Tags</span>
              </div>

              <div>
                {selectedCluster ? (
                  selectedCluster.trends.map((trend, index) => (
                    <div
                      key={trend.trend}
                      className="grid grid-cols-[2rem_1.4fr_6rem_6rem_1fr] gap-4 border-b border-white/4 px-5 py-3 text-sm last:border-b-0"
                    >
                      <span className="font-mono text-zinc-800">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="truncate text-white/85">{trend.trend}</span>
                      <span className="text-right font-mono text-amber-400">
                        {formatCompactNumber(trend.post_count)}
                      </span>
                      <span className="text-right font-mono text-zinc-500">
                        {formatPercent(
                          selectedCluster.totalPosts > 0
                            ? trend.post_count / selectedCluster.totalPosts
                            : 0,
                        )}
                      </span>
                      <span className="truncate font-mono text-[11px] text-zinc-600">
                        {trend.representative_hashtags.join(" ") || "derived"}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="px-5 py-10 text-sm text-zinc-500">
                    Pick a live cluster from the index below.
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-white/6 bg-white/[0.015]">
              <div className="flex items-center justify-between border-b border-white/6 px-5 py-3">
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-[0.24em] text-zinc-700">
                    All live clusters
                  </div>
                  <div className="mt-1 text-sm text-zinc-500">
                    Full cluster index for the current trend window, ordered by overlap first.
                  </div>
                </div>
                <div className="text-[10px] font-mono uppercase tracking-[0.24em] text-zinc-700">
                  {relatedClusters.length} tracked
                </div>
              </div>

              <div className="grid grid-cols-[9rem_5rem_6rem_1fr] gap-4 border-b border-white/6 px-5 py-2 text-[10px] font-mono uppercase tracking-widest text-zinc-700">
                <span>Cluster</span>
                <span className="text-right">Members</span>
                <span className="text-right">Volume</span>
                <span>Lead trend</span>
              </div>

              <div>
                {relatedClusters.map((cluster) => {
                  const active = cluster.slug === selectedCluster?.slug;

                  return (
                    <Link
                      key={cluster.slug}
                      href={`/dashboard/${cluster.slug}`}
                      className={cn(
                        "grid grid-cols-[9rem_5rem_6rem_1fr] gap-4 border-b border-white/4 px-5 py-3 text-sm transition-colors last:border-b-0 hover:bg-white/[0.03]",
                        active && "bg-amber-500/[0.05]",
                      )}
                    >
                      <span className={cn("font-semibold", active ? "text-amber-400" : "text-white/85")}>
                        {displayKeyword(cluster.keyword)}
                      </span>
                      <span className="text-right font-mono text-zinc-500">
                        {cluster.memberCount}
                      </span>
                      <span className="text-right font-mono text-zinc-400">
                        {formatCompactNumber(cluster.totalPosts)}
                      </span>
                      <span className="truncate text-zinc-500">
                        {cluster.leadTrend.trend}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </section>
          </div>
        </div>

        <div className="min-w-0 flex-[1.8] overflow-hidden">
          <BuildProcess
            trends={trendStream.trends}
            connected={trendStream.connected}
            isLoading={trendStream.isLoading}
            selectedTrend={selectedCluster?.leadTrend ?? null}
          />
        </div>
      </div>
    </div>
  );
}
