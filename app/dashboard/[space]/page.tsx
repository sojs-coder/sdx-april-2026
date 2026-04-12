"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Hash, RadioTower, WifiOff } from "lucide-react";
import { BuildProcess } from "@/components/dashboard/BuildProcess";
import { useTwitterTrends } from "@/hooks/useTwitterTrends";
import {
  formatCompactNumber,
  formatFetchedAtLabel,
  trendSlug,
} from "@/lib/twitter-trends";
import { cn } from "@/lib/utils";

export default function SpacePage() {
  const params = useParams<{ space: string }>();
  const slug = params.space ?? "";
  const trendStream = useTwitterTrends({ interval: 45_000, limit: 12 });
  const selectedTrend =
    trendStream.trends.find((trend) => trendSlug(trend.trend) === slug) ?? null;
  const tags = selectedTrend?.representative_hashtags.slice(0, 4) ?? [];

  return (
    <div className="flex h-screen flex-col overflow-hidden pt-11">
      <div className="flex flex-shrink-0 items-center gap-3 border-b border-amber-500/8 px-4 py-1.5 text-[11px] font-mono">
        <Link
          href="/dashboard"
          className="flex items-center gap-1.5 text-zinc-700 transition-colors hover:text-zinc-400"
        >
          <ArrowLeft className="h-3 w-3" />
          trends
        </Link>
        <span className="text-zinc-800">|</span>
        <span className="truncate text-white/60">
          {selectedTrend?.trend ?? slug}
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
        <div className="min-w-0 flex-[3] overflow-y-auto border-r border-white/5">
          <div className="flex max-w-xl flex-col gap-7 p-8">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <h1 className="text-4xl font-bold tracking-tight text-white">
                {selectedTrend?.trend ?? "Trend unavailable"}
              </h1>
              <p className="mt-1.5 text-sm text-zinc-600">
                {selectedTrend
                  ? "Live Twitter trend snapshot pulled from the extraction pipeline."
                  : "This trend is no longer in the current live window."}
              </p>
            </motion.div>

            {selectedTrend ? (
              <>
                <motion.p
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.08, duration: 0.3 }}
                  className="text-sm leading-relaxed text-zinc-400"
                >
                  This topic is currently surfacing with strong short-term momentum. Use it as a seed for rapid market
                  briefs, landing pages, or campaign experiments while the attention window is still active.
                </motion.p>

                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.16, duration: 0.3 }}
                  className="rounded-lg border border-amber-500/15 bg-amber-500/[0.03] p-4"
                >
                  <div className="mb-2 text-[10px] font-mono uppercase tracking-widest text-amber-500/50">
                    Live opportunity
                  </div>
                  <p className="text-sm text-zinc-400">
                    Package this trend into a monitoring dashboard, alerting workflow, or lightweight content product
                    while the conversation velocity is elevated.
                  </p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.24, duration: 0.3 }}
                  className="space-y-4"
                >
                  <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-800">
                    Live metrics
                  </div>

                  <div className="flex items-center gap-8 font-mono text-xs">
                    <div>
                      <div className="font-bold tabular-nums text-white">
                        {formatCompactNumber(selectedTrend.post_count)}
                      </div>
                      <div className="mt-0.5 text-[10px] text-zinc-700">posts/hr</div>
                    </div>
                    <div>
                      <div className="font-bold tabular-nums text-amber-400">
                        {formatCompactNumber(selectedTrend.trend_score)}
                      </div>
                      <div className="mt-0.5 text-[10px] text-zinc-700">reach</div>
                    </div>
                    <div>
                      <div className="font-bold tabular-nums text-zinc-400">
                        {tags.length}
                      </div>
                      <div className="mt-0.5 text-[10px] text-zinc-700">hashtags</div>
                    </div>
                  </div>

                  <div className="h-px w-56 overflow-hidden rounded-full bg-white/5">
                    <motion.div
                      className="h-full origin-left rounded-full bg-amber-500"
                      animate={{
                        scaleX:
                          selectedTrend.trend_score > 0 && trendStream.trends[0]
                            ? Math.max(0.08, selectedTrend.trend_score / trendStream.trends[0].trend_score)
                            : 0,
                      }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {tags.length > 0 ? (
                      tags.map((tag) => (
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
                        No representative hashtags on this trend.
                      </div>
                    )}
                  </div>
                </motion.div>
              </>
            ) : (
              <div className="text-sm text-zinc-500">
                Return to the dashboard and pick a currently active trend.
              </div>
            )}
          </div>
        </div>

        <div className="min-w-0 flex-[2] overflow-hidden">
          <BuildProcess
            trends={trendStream.trends}
            connected={trendStream.connected}
            isLoading={trendStream.isLoading}
            selectedTrend={selectedTrend}
          />
        </div>
      </div>
    </div>
  );
}
