"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useMemo } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useSentiment } from "@/hooks/useSentiment";
import { BuildProcess } from "@/components/dashboard/BuildProcess";
import { cn } from "@/lib/utils";

// ─── Idea space descriptions ──────────────────────────────────────
const SPACES: Record<string, { tagline: string; body: string; opportunity: string }> = {
  AI: {
    tagline: "Tooling, models, and autonomous agents",
    body: "Builder convergence is accelerating around AI infrastructure. Developer APIs, fine-tuning pipelines, and agent orchestration are the active fault lines. First-mover advantage compounds quickly — the teams shipping in the next 90 days will own significant distribution before incumbents catch up.",
    opportunity: "LLM observability dashboards, agent memory layers, or fine-tuning-as-a-service for niche verticals.",
  },
  HEALTH: {
    tagline: "Digital health, sensors, and behavioral nudges",
    body: "Wearable data outpaces user comprehension. The gap between data collection and actionable insight is wide open. Consumer apps that close this gap earn sticky, high-retention audiences — and the regulatory tailwind is real.",
    opportunity: "Personalized health dashboards, symptom journaling with AI pattern recognition, or sleep quality coaching.",
  },
  CLIMATE: {
    tagline: "Carbon tracking, clean energy, and sustainability ops",
    body: "Regulatory pressure is creating urgent demand for compliance tooling. Founders who build the infrastructure layer now will own distribution when mandates hit at scale. The B2B angle is particularly strong — enterprises need audit-ready carbon data yesterday.",
    opportunity: "SMB carbon footprint tracking, renewable energy procurement automation, or supply chain ESG auditing.",
  },
  FINTECH: {
    tagline: "Payments, lending, and financial infrastructure",
    body: "Embedded finance is reaching every vertical. The opportunity is no longer in creating the rails — it is in layering intelligence and personalisation on top of existing infrastructure. SMBs are chronically underserved by tooling built for enterprise.",
    opportunity: "Spend analytics for SMBs, lending pre-qualification flows, or automated invoice reconciliation.",
  },
  EDTECH: {
    tagline: "Learning systems, tutoring, and skill development",
    body: "The cohort-model boom is plateauing. The next cycle belongs to adaptive systems that personalise pacing and content depth. Credential portability is an unsolved problem, and employers are increasingly skills-first rather than degree-first.",
    opportunity: "AI tutoring for niche professional skills, micro-credential marketplaces, or job-readiness simulators.",
  },
  GAMING: {
    tagline: "Indie games, tooling, and player communities",
    body: "Solo and small-team game development is at an all-time high. Distribution is the bottleneck, not production. Communities form around games that ship fast and iterate in public — the early-access model rewards momentum builders.",
    opportunity: "Game jam collaboration tools, indie publishing pipelines, or in-game community analytics.",
  },
  CREATOR: {
    tagline: "Monetisation, audience tools, and content ops",
    body: "The creator middle class is underserved by platforms built for the top 1%. Infrastructure for the long tail — scheduling, revenue diversification, audience CRM — remains fragmented across too many tools. Consolidation is the play.",
    opportunity: "All-in-one creator CRM, brand deal automation, or cross-platform analytics and revenue tracking.",
  },
  WEB3: {
    tagline: "Protocols, wallets, and onchain products",
    body: "Speculation is cooling but infrastructure builders are shipping. The winners in this cycle focus on UX abstraction — reducing the cognitive overhead of onchain interactions to near-zero for mainstream users.",
    opportunity: "Wallet-as-a-service for consumer apps, NFT utility tooling, or cross-chain bridging with clean UX.",
  },
  DEVTOOLS: {
    tagline: "Developer experience, CI/CD, and observability",
    body: "Developers buy tools that save time immediately. The bar is high but willingness to pay is real. AI-native tooling is resetting expectations around how much can be automated — teams that nail the workflow integration win fast.",
    opportunity: "AI-assisted code review, staging environment automation, or developer onboarding toolkits.",
  },
  SPATIAL: {
    tagline: "AR, VR, and ambient computing interfaces",
    body: "Spatial computing is moving from novelty to utility as device costs fall. Workflow productivity is emerging as the most fundable vertical — field service, remote collaboration, hands-free training. The window before consolidation is open.",
    opportunity: "Spatial note-taking tools, virtual whiteboards for remote teams, or AR-assisted field service apps.",
  },
};

// ─── Live metrics for one space ──────────────────────────────────
function useSpaceMetrics(ticker: string) {
  const { signals } = useSentiment({ interval: 2200, maxSignals: 60 });
  return useMemo(() => {
    const mine = signals.filter(s => s.ticker === ticker);
    if (!mine.length) return { score: 0, count: 0, bullish: 0, bearish: 0, heat: 0, direction: "neutral" as const };
    const score   = mine.reduce((a, s) => a + s.score, 0) / mine.length;
    const bullish = mine.filter(s => s.direction === "bullish").length;
    const bearish = mine.filter(s => s.direction === "bearish").length;
    return {
      score,
      count:  mine.length,
      bullish,
      bearish,
      heat: Math.min(1, mine.length / 12),
      direction: (score > 0.08 ? "bullish" : score < -0.08 ? "bearish" : "neutral") as "bullish" | "bearish" | "neutral",
    };
  }, [signals, ticker]);
}

// ─── Page ─────────────────────────────────────────────────────────
export default function SpacePage() {
  const params  = useParams();
  const ticker  = (params.space as string).toUpperCase();
  const info    = SPACES[ticker];
  const metrics = useSpaceMetrics(ticker);

  const isBull = metrics.direction === "bullish";
  const isBear = metrics.direction === "bearish";
  const scoreColor = isBull ? "text-amber-400" : isBear ? "text-red-400" : "text-zinc-500";
  const Icon = isBull ? TrendingUp : isBear ? TrendingDown : Minus;

  return (
    <div className="flex flex-col h-screen overflow-hidden pt-11">

      {/* Slim top bar — mirrors the dashboard Banner style */}
      <div className="flex items-center gap-3 px-4 py-1.5 border-b border-amber-500/8 text-[11px] font-mono flex-shrink-0">
        <Link
          href="/dashboard"
          className="flex items-center gap-1.5 text-zinc-700 hover:text-zinc-400 transition-colors"
        >
          <ArrowLeft className="w-3 h-3" />
          spaces
        </Link>
        <span className="text-zinc-800">·</span>
        <span className="text-white/50">{ticker}</span>
        <div className={cn("flex items-center gap-1.5 ml-auto font-bold tabular-nums", scoreColor)}>
          <Icon className="w-3 h-3" />
          {metrics.score > 0 ? "+" : ""}{(metrics.score * 100).toFixed(1)}%
        </div>
      </div>

      {/* Two-pane body */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left — idea detail */}
        <div className="flex-[3] min-w-0 border-r border-white/5 overflow-y-auto">
          <div className="p-8 flex flex-col gap-7 max-w-lg">

            {/* Heading */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <h1 className="text-4xl font-bold tracking-tight text-white">{ticker}</h1>
              {info ? (
                <p className="text-sm text-zinc-600 mt-1.5">{info.tagline}</p>
              ) : (
                <p className="text-sm text-zinc-700 mt-1.5">No description available.</p>
              )}
            </motion.div>

            {/* Body */}
            {info && (
              <motion.p
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08, duration: 0.3 }}
                className="text-sm text-zinc-400 leading-relaxed"
              >
                {info.body}
              </motion.p>
            )}

            {/* Opportunity callout */}
            {info && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.16, duration: 0.3 }}
                className="rounded-lg border border-amber-500/15 bg-amber-500/[0.03] p-4"
              >
                <div className="text-[10px] font-mono text-amber-500/50 uppercase tracking-widest mb-2">
                  Build opportunity
                </div>
                <p className="text-sm text-zinc-400">{info.opportunity}</p>
              </motion.div>
            )}

            {/* Live signal stats */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.24, duration: 0.3 }}
              className="space-y-3"
            >
              <div className="text-[10px] font-mono text-zinc-800 uppercase tracking-widest">
                Live signals
              </div>

              <div className="flex items-center gap-6 font-mono text-xs">
                <div>
                  <div className="text-white tabular-nums font-bold">{metrics.count}</div>
                  <div className="text-zinc-700 text-[10px] mt-0.5">total</div>
                </div>
                <div>
                  <div className="text-amber-400 tabular-nums font-bold">{metrics.bullish}</div>
                  <div className="text-zinc-700 text-[10px] mt-0.5">rising</div>
                </div>
                <div>
                  <div className="text-red-400/70 tabular-nums font-bold">{metrics.bearish}</div>
                  <div className="text-zinc-700 text-[10px] mt-0.5">cooling</div>
                </div>
              </div>

              {/* Heat bar */}
              <div className="h-px w-48 bg-white/5 rounded-full overflow-hidden">
                <motion.div
                  className={cn(
                    "h-full rounded-full origin-left",
                    isBull ? "bg-amber-500" : isBear ? "bg-red-500" : "bg-zinc-600"
                  )}
                  animate={{ scaleX: metrics.heat }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                />
              </div>
            </motion.div>

          </div>
        </div>

        {/* Right — build process pinned to this space */}
        <div className="flex-[2] min-w-0 overflow-hidden">
          <BuildProcess forceTicker={ticker} />
        </div>

      </div>
    </div>
  );
}
