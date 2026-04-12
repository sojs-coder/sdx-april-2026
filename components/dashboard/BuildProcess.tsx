"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ExternalLink, Loader } from "lucide-react";
import type { TwitterTrend } from "@/lib/twitter-trends";
import { formatCompactNumber, trendSlug } from "@/lib/twitter-trends";
import { cn } from "@/lib/utils";

const STEPS = [
  { id: "capture", label: "Trend captured", duration: 900 },
  { id: "classify", label: "Signal clustered", duration: 1200 },
  { id: "scaffold", label: "Opportunity framed", duration: 1900 },
  { id: "bundle", label: "Prototype scaffolded", duration: 1500 },
  { id: "ready", label: "Ready to deploy", duration: 0 },
] as const;

type StepId = typeof STEPS[number]["id"];

interface LogLine {
  id: string;
  step: StepId;
  text: string;
  ts: number;
}

function makeLogLine(step: StepId, trend: TwitterTrend): string {
  const tags = trend.representative_hashtags.slice(0, 2).join(" ");
  const rate = `${formatCompactNumber(trend.post_count)} posts/hr`;

  switch (step) {
    case "capture":
      return `[trend]  ${trend.trend} | ${rate}`;
    case "classify":
      return tags
        ? `[cluster] matched ${tags} | reach=${formatCompactNumber(trend.trend_score)}`
        : `[cluster] standalone keyword | reach=${formatCompactNumber(trend.trend_score)}`;
    case "scaffold":
      return `[brief]  market brief generated | ${Math.floor(Math.random() * 3) + 2} angles`;
    case "bundle":
      return `[build]  next preview compiled in ${(Math.random() * 1.1 + 1.1).toFixed(1)}s`;
    case "ready":
      return `[ready]  ${trendSlug(trend.trend)}.bullishforge.app`;
  }
}

function StepDot({ status }: { status: "done" | "active" | "pending" }) {
  if (status === "done") {
    return (
      <div
        className="flex h-4 w-4 items-center justify-center rounded-full bg-amber-500/20"
        role="img"
        aria-label="Complete"
      >
        <Check className="h-2.5 w-2.5 text-amber-500" aria-hidden="true" />
      </div>
    );
  }

  if (status === "active") {
    return (
      <div
        className="flex h-4 w-4 items-center justify-center rounded-full border border-amber-500/60"
        role="status"
        aria-label="In progress"
      >
        <Loader className="h-2.5 w-2.5 animate-spin text-amber-500" aria-hidden="true" />
      </div>
    );
  }

  return <div className="h-4 w-4 rounded-full border border-white/10" role="img" aria-label="Pending" />;
}

function StepProgress({ duration, active }: { duration: number; active: boolean }) {
  if (!active || duration === 0) {
    return null;
  }

  return (
    <div className="mt-1.5 h-px w-full overflow-hidden rounded-full bg-white/6">
      <motion.div
        className="h-full origin-left rounded-full bg-amber-500/60"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: duration / 1000, ease: "linear" }}
      />
    </div>
  );
}

export function BuildProcess({
  trends,
  connected,
  isLoading,
}: {
  trends: TwitterTrend[];
  connected: boolean;
  isLoading: boolean;
}) {
  const topTrend = trends[0];
  const [activeStepIdx, setActiveStepIdx] = useState(0);
  const [doneSteps, setDoneSteps] = useState<Set<StepId>>(new Set());
  const [log, setLog] = useState<LogLine[]>([]);
  const [buildKey, setBuildKey] = useState(0);
  const prevTrendRef = useRef("");
  const buildTrendRef = useRef<TwitterTrend | null>(null);
  const generationRef = useRef(0);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!topTrend) {
      return;
    }

    if (topTrend.trend !== prevTrendRef.current) {
      prevTrendRef.current = topTrend.trend;
      buildTrendRef.current = topTrend;
      setBuildKey((current) => current + 1);
    }
  }, [topTrend]);

  useEffect(() => {
    const trend = buildTrendRef.current;
    if (!trend) {
      return;
    }

    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];

    const generation = ++generationRef.current;

    setActiveStepIdx(0);
    setDoneSteps(new Set());
    setLog([]);

    let delay = 0;
    STEPS.forEach((step, index) => {
      const startTimer = setTimeout(() => {
        if (generationRef.current !== generation) {
          return;
        }

        setActiveStepIdx(index);
        setLog((current) => [
          ...current.slice(-20),
          {
            id: `${buildKey}-${step.id}`,
            step: step.id,
            text: makeLogLine(step.id, trend),
            ts: Date.now(),
          },
        ]);
      }, delay);
      timersRef.current.push(startTimer);

      if (step.duration > 0) {
        delay += step.duration;
        const finishTimer = setTimeout(() => {
          if (generationRef.current !== generation) {
            return;
          }

          setDoneSteps((current) => new Set([...current, step.id]));
        }, delay);
        timersRef.current.push(finishTimer);
      }
    });

    return () => {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    };
  }, [buildKey]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [log]);

  const isReady = doneSteps.has("bundle") && activeStepIdx === STEPS.length - 1;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-shrink-0 space-y-3 border-b border-white/5 p-5">
        {STEPS.map((step, index) => {
          const status = doneSteps.has(step.id)
            ? "done"
            : activeStepIdx === index
              ? "active"
              : "pending";
          const isActive = activeStepIdx === index && !doneSteps.has(step.id);

          return (
            <div key={step.id}>
              <div className="flex items-center gap-3">
                <StepDot status={status} />
                <span
                  className={cn(
                    "text-sm font-medium transition-colors",
                    status === "done"
                      ? "text-amber-400/80"
                      : status === "active"
                        ? "text-white"
                        : "text-zinc-700",
                  )}
                >
                  {step.label}
                </span>
                {status === "done" && (
                  <span className="ml-auto text-[10px] font-mono uppercase text-zinc-800">done</span>
                )}
              </div>
              <StepProgress duration={step.duration} active={isActive} />
            </div>
          );
        })}
      </div>

      <div className="flex-1 space-y-1 overflow-y-auto p-4 font-mono text-[11px]">
        <AnimatePresence initial={false}>
          {log.map((line) => (
            <motion.div
              key={line.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={cn(
                "leading-relaxed",
                line.step === "ready"
                  ? "text-amber-400"
                  : line.step === "capture"
                    ? "text-zinc-400"
                    : "text-zinc-600",
              )}
            >
              {line.text}
            </motion.div>
          ))}
        </AnimatePresence>

        {isLoading && log.length === 0 && (
          <div className="text-zinc-700">waiting for twitter extractor...</div>
        )}

        {!isLoading && !connected && log.length === 0 && (
          <div className="text-zinc-700">relay offline - no live trend build yet</div>
        )}

        {!isLoading && connected && !topTrend && log.length === 0 && (
          <div className="text-zinc-700">extractor returned no active trends</div>
        )}

        {log.length > 0 && !isReady && (
          <span className="animate-blink text-amber-500/60">_</span>
        )}

        <div ref={logEndRef} />
      </div>

      <AnimatePresence>
        {isReady && topTrend && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="flex-shrink-0 border-t border-white/5 p-4"
          >
            <button
              type="button"
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500 py-2.5 text-sm font-semibold text-[#0C0A08] transition-colors hover:bg-amber-400"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Deploy {trendSlug(topTrend.trend)} app
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
