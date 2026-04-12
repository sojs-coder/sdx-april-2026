"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSentiment } from "@/hooks/useSentiment";
import { cn } from "@/lib/utils";
import { Check, ExternalLink, Loader } from "lucide-react";

// ─── Pipeline step definitions ────────────────────────────────────
const STEPS = [
  { id: "capture",   label: "Signal captured",    duration: 900  },
  { id: "classify",  label: "Intent classified",   duration: 1400 },
  { id: "scaffold",  label: "Scaffold generated",  duration: 2200 },
  { id: "bundle",    label: "Preview bundled",     duration: 1600 },
  { id: "ready",     label: "Ready to deploy",     duration: 0    }, // terminal
] as const;

type StepId = typeof STEPS[number]["id"];

interface LogLine {
  id: string;
  step: StepId;
  text: string;
  ts: number;
}

// ─── Log templates per step ──────────────────────────────────────
function makeLogLine(step: StepId, ticker: string, score: number, source: string): string {
  const s = score > 0 ? `+${(score * 100).toFixed(0)}` : (score * 100).toFixed(0);
  switch (step) {
    case "capture":   return `[signal] ${ticker} ${s}% · ${source}`;
    case "classify":  return score > 0.2
      ? `[intent] bullish momentum · high confidence`
      : score > 0
      ? `[intent] bullish signal · medium confidence`
      : `[intent] bearish signal · detected`;
    case "scaffold":  return `[forge]  Next.js · ${Math.floor(Math.random() * 400 + 600)} lines`;
    case "bundle":    return `[build]  compiled in ${(Math.random() * 1.8 + 1.2).toFixed(1)}s · 0 errors`;
    case "ready":     return `[ready]  ${ticker.toLowerCase()}-app.vercel.app`;
  }
}

// ─── Step indicator ──────────────────────────────────────────────
function StepDot({ status }: { status: "done" | "active" | "pending" }) {
  if (status === "done")
    return (
      <div className="w-4 h-4 rounded-full bg-amber-500/20 flex items-center justify-center">
        <Check className="w-2.5 h-2.5 text-amber-500" />
      </div>
    );
  if (status === "active")
    return (
      <div className="w-4 h-4 rounded-full border border-amber-500/60 flex items-center justify-center">
        <Loader className="w-2.5 h-2.5 text-amber-500 animate-spin" />
      </div>
    );
  return (
    <div className="w-4 h-4 rounded-full border border-white/10" />
  );
}

// ─── Progress bar for active step ───────────────────────────────
function StepProgress({ duration, active }: { duration: number; active: boolean }) {
  if (!active || duration === 0) return null;
  return (
    <div className="mt-1.5 h-px bg-white/6 rounded-full overflow-hidden w-full">
      <motion.div
        className="h-full bg-amber-500/60 rounded-full"
        initial={{ width: "0%" }}
        animate={{ width: "100%" }}
        transition={{ duration: duration / 1000, ease: "linear" }}
      />
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────
export function BuildProcess() {
  const { signals, metrics } = useSentiment({ interval: 2200 });

  const [activeStepIdx, setActiveStepIdx] = useState(0);
  const [doneSteps, setDoneSteps] = useState<Set<StepId>>(new Set());
  const [log, setLog] = useState<LogLine[]>([]);
  const [buildKey, setBuildKey] = useState(0); // restart trigger
  const prevTickerRef = useRef<string>("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runningRef = useRef(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  const topSignal = signals[0];

  // Restart pipeline when dominant ticker changes
  useEffect(() => {
    if (!topSignal) return;
    if (topSignal.ticker !== prevTickerRef.current) {
      prevTickerRef.current = topSignal.ticker;
      setBuildKey((k) => k + 1);
    }
  }, [topSignal]);

  // Run the pipeline whenever buildKey increments
  useEffect(() => {
    if (!topSignal) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    runningRef.current = true;
    setActiveStepIdx(0);
    setDoneSteps(new Set());
    setLog([]);

    let delay = 0;
    STEPS.forEach((step, idx) => {
      // Add log line at step start
      timerRef.current = setTimeout(() => {
        if (!runningRef.current) return;
        setActiveStepIdx(idx);
        const line: LogLine = {
          id: `${buildKey}-${step.id}`,
          step: step.id,
          text: makeLogLine(step.id, topSignal.ticker, topSignal.score, topSignal.source),
          ts: Date.now(),
        };
        setLog((prev) => [...prev.slice(-20), line]);
      }, delay);

      // Mark done after duration
      if (step.duration > 0) {
        delay += step.duration;
        const finishDelay = delay;
        timerRef.current = setTimeout(() => {
          if (!runningRef.current) return;
          setDoneSteps((prev) => new Set([...prev, step.id]));
        }, finishDelay);
      }
    });

    return () => {
      runningRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildKey]);

  // Auto-scroll log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [log]);

  const isDone = doneSteps.has("bundle");
  const isReady = doneSteps.has("bundle") && activeStepIdx === STEPS.length - 1;

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Pipeline steps */}
      <div className="flex-shrink-0 p-5 border-b border-white/5 space-y-3">
        {STEPS.map((step, idx) => {
          const status = doneSteps.has(step.id) ? "done"
            : activeStepIdx === idx ? "active"
            : "pending";
          const isActive = activeStepIdx === idx && !doneSteps.has(step.id);

          return (
            <div key={step.id}>
              <div className="flex items-center gap-3">
                <StepDot status={status} />
                <span className={cn(
                  "text-sm font-medium transition-colors",
                  status === "done"   ? "text-amber-400/80" :
                  status === "active" ? "text-white" :
                  "text-zinc-700"
                )}>
                  {step.label}
                </span>
                {status === "done" && (
                  <span className="text-[10px] font-mono text-zinc-800 ml-auto">✓</span>
                )}
              </div>
              <StepProgress duration={step.duration} active={isActive} />
            </div>
          );
        })}
      </div>

      {/* Live log */}
      <div className="flex-1 overflow-y-auto p-4 space-y-1 font-mono text-[11px]">
        <AnimatePresence initial={false}>
          {log.map((line) => (
            <motion.div
              key={line.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={cn(
                "leading-relaxed",
                line.step === "ready" ? "text-amber-400" :
                line.step === "capture" ? "text-zinc-400" :
                "text-zinc-600"
              )}
            >
              {line.text}
            </motion.div>
          ))}
        </AnimatePresence>
        {log.length > 0 && !isReady && (
          <span className="text-amber-500/60 animate-blink">█</span>
        )}
        <div ref={logEndRef} />
      </div>

      {/* Deploy CTA — only shows when pipeline is complete */}
      <AnimatePresence>
        {isReady && topSignal && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="flex-shrink-0 p-4 border-t border-white/5"
          >
            <button className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-amber-500 text-[#0C0A08] text-sm font-semibold hover:bg-amber-400 transition-colors">
              <ExternalLink className="w-3.5 h-3.5" />
              Deploy {topSignal.ticker} app
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
