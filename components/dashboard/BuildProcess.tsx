"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronRight, Loader, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Idea {
  name: string;
  tagline: string;
  related_trend: string;
  problem: string;
  full_prd: Record<string, unknown>;
}

interface LogLine {
  id: string;
  role: string;
  text: string;
}

type Phase =
  | { type: "idle" }
  | { type: "generating" }
  | { type: "error"; message: string }
  | { type: "ideas"; ideas: Idea[] }
  | { type: "building"; idea: Idea; jobId: string }
  | { type: "done"; idea: Idea };

// ─── Pipeline steps ───────────────────────────────────────────────────────────

const STEPS = [
  { id: "prompt",   label: "Prompt dispatched"   },
  { id: "scaffold", label: "Scaffold generated"  },
  { id: "backend",  label: "Backend implemented" },
  { id: "frontend", label: "Frontend built"      },
  { id: "ready",    label: "Ready to deploy"     },
] as const;

function inferStepIdx(log: LogLine[]): number {
  const combined = log.map((l) => l.text.toLowerCase()).join(" ");
  if (combined.includes("deploy") || combined.includes("ready")) return 4;
  if (combined.includes("frontend") || combined.includes("page") || combined.includes("component")) return 3;
  if (combined.includes("backend") || combined.includes("api") || combined.includes("database") || combined.includes("schema")) return 2;
  if (combined.includes("scaffold") || combined.includes("package.json") || combined.includes("mkdir")) return 1;
  if (log.length > 0) return 0;
  return -1;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepDot({ status }: { status: "done" | "active" | "pending" }) {
  if (status === "done") {
    return (
      <div className="flex h-4 w-4 items-center justify-center rounded-full bg-amber-500/20" role="img" aria-label="Complete">
        <Check className="h-2.5 w-2.5 text-amber-500" aria-hidden="true" />
      </div>
    );
  }
  if (status === "active") {
    return (
      <div className="flex h-4 w-4 items-center justify-center rounded-full border border-amber-500/60" role="status" aria-label="In progress">
        <Loader className="h-2.5 w-2.5 animate-spin text-amber-500" aria-hidden="true" />
      </div>
    );
  }
  return <div className="h-4 w-4 rounded-full border border-white/10" role="img" aria-label="Pending" />;
}

function IdeaCard({ idea, onBuild }: { idea: Idea; onBuild: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg border border-white/8 bg-white/[0.02] p-4 space-y-2"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{idea.name}</p>
          <p className="truncate text-[11px] font-mono text-zinc-600">{idea.tagline}</p>
        </div>
        <span className="flex-shrink-0 rounded bg-amber-500/8 px-1.5 py-0.5 text-[10px] font-mono text-amber-500/70">
          #{idea.related_trend}
        </span>
      </div>
      <p className="line-clamp-2 text-[11px] leading-relaxed text-zinc-600">{idea.problem}</p>
      <button
        type="button"
        onClick={onBuild}
        className="flex w-full items-center justify-center gap-1.5 rounded bg-amber-500 py-1.5 text-xs font-bold text-[#0C0A08] transition-colors hover:bg-amber-400"
      >
        <Zap className="h-3 w-3" />
        Build this
      </button>
    </motion.div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

export function BuildProcess({
  connected = false,
}: {
  trends?: { trend: string }[];
  connected?: boolean;
  isLoading?: boolean;
  selectedTrend?: unknown;
}) {
  const [phase, setPhase] = useState<Phase>({ type: "idle" });
  const [log, setLog] = useState<LogLine[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [log]);

  useEffect(() => () => { esRef.current?.close(); }, []);

  async function handleGenerate() {
    setPhase({ type: "generating" });
    try {
      const resp = await fetch("/api/ideas");
      const data = await resp.json() as { ideas?: Idea[]; error?: string };
      if (!resp.ok) throw new Error(data.error ?? "Failed to generate ideas");
      setPhase({ type: "ideas", ideas: data.ideas ?? [] });
    } catch (err) {
      setPhase({ type: "error", message: err instanceof Error ? err.message : "Unknown error" });
    }
  }

  async function handleBuild(idea: Idea) {
    setLog([]);
    setPhase({ type: "building", idea, jobId: "" });

    let jobId: string;
    try {
      const resp = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea }),
      });
      const data = await resp.json() as { job_id?: string; detail?: string };
      if (!resp.ok) throw new Error(data.detail ?? "Failed to submit job");
      jobId = data.job_id!;
    } catch (err) {
      setPhase({ type: "error", message: err instanceof Error ? err.message : "Unknown error" });
      return;
    }

    setPhase({ type: "building", idea, jobId });

    esRef.current?.close();
    const es = new EventSource(`/api/jobs/${jobId}/stream`);
    esRef.current = es;

    es.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as {
          role?: string;
          content?: string;
          status?: string;
          error?: string;
        };
        if (msg.status) {
          es.close();
          setPhase({ type: "done", idea });
          return;
        }
        if (msg.error) {
          es.close();
          setPhase({ type: "error", message: msg.error });
          return;
        }
        if (msg.content) {
          setLog((prev) => [
            ...prev.slice(-60),
            { id: `${Date.now()}-${Math.random()}`, role: msg.role ?? "assistant", text: msg.content! },
          ]);
        }
      } catch {
        // ignore malformed events
      }
    };

    es.onerror = () => {
      es.close();
      setPhase((p) => p.type === "building" ? { type: "done", idea } : p);
    };
  }

  function handleReset() {
    esRef.current?.close();
    setLog([]);
    setPhase({ type: "idle" });
  }

  const activeStepIdx =
    phase.type === "done" ? STEPS.length - 1
    : phase.type === "building" ? inferStepIdx(log)
    : -1;

  return (
    <div className="flex h-full flex-col overflow-hidden">

      {/* Pipeline steps — shown during build / done */}
      <AnimatePresence>
        {(phase.type === "building" || phase.type === "done") && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-shrink-0 space-y-3 border-b border-white/5 p-5"
          >
            {STEPS.map((step, idx) => {
              const status =
                phase.type === "done" || idx < activeStepIdx ? "done"
                : idx === activeStepIdx ? "active"
                : "pending";
              return (
                <div key={step.id} className="flex items-center gap-3">
                  <StepDot status={status} />
                  <span className={cn(
                    "text-sm font-medium transition-colors",
                    status === "done" ? "text-amber-400/80"
                    : status === "active" ? "text-white"
                    : "text-zinc-700",
                  )}>
                    {step.label}
                  </span>
                  {status === "done" && (
                    <span className="ml-auto text-[10px] font-mono uppercase text-zinc-800">done</span>
                  )}
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">

        {phase.type === "idle" && (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-6">
            <p className="text-center text-xs font-mono text-zinc-600">
              Generate micro-SaaS ideas from live trending topics, then build one with an AI agent.
            </p>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={!connected}
              className="flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-[#0C0A08] transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Zap className="h-3.5 w-3.5" />
              Generate PRDs
            </button>
            {!connected && (
              <p className="text-[11px] font-mono text-zinc-700">waiting for trend data...</p>
            )}
          </div>
        )}

        {phase.type === "generating" && (
          <div className="flex h-full flex-col items-center justify-center gap-3">
            <Loader className="h-5 w-5 animate-spin text-amber-500" />
            <p className="text-xs font-mono text-zinc-600">generating ideas from live trends...</p>
            <p className="text-[10px] font-mono text-zinc-800">takes ~30–60s</p>
          </div>
        )}

        {phase.type === "error" && (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6">
            <p className="text-center text-xs font-mono text-red-400">{phase.message}</p>
            <button
              type="button"
              onClick={handleReset}
              className="text-[11px] font-mono text-zinc-600 underline underline-offset-2"
            >
              try again
            </button>
          </div>
        )}

        {phase.type === "ideas" && (
          <div className="space-y-3 p-4">
            <p className="mb-1 text-[10px] font-mono uppercase tracking-widest text-zinc-700">
              {phase.ideas.length} ideas — pick one to build
            </p>
            {phase.ideas.map((idea) => (
              <IdeaCard key={idea.name} idea={idea} onBuild={() => handleBuild(idea)} />
            ))}
            <button
              type="button"
              onClick={handleGenerate}
              className="w-full py-1 text-[11px] font-mono text-zinc-700 transition-colors hover:text-zinc-400"
            >
              regenerate
            </button>
          </div>
        )}

        {(phase.type === "building" || phase.type === "done") && (
          <div className="space-y-1 p-4 font-mono text-[11px]">
            {phase.type === "building" && log.length === 0 && (
              <span className="text-zinc-700">waiting for agent output...</span>
            )}
            <AnimatePresence initial={false}>
              {log.map((line) => (
                <motion.div
                  key={line.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.15 }}
                  className={cn(
                    "break-words leading-relaxed",
                    line.role === "tool" ? "text-zinc-600"
                    : line.role === "user" ? "text-zinc-700"
                    : "text-zinc-400",
                  )}
                >
                  {line.text}
                </motion.div>
              ))}
            </AnimatePresence>
            {phase.type === "building" && (
              <span className="animate-blink text-amber-500/60">█</span>
            )}
            <div ref={logEndRef} />
          </div>
        )}
      </div>

      {/* Footer */}
      <AnimatePresence>
        {phase.type === "done" && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="flex-shrink-0 flex flex-col gap-2 border-t border-white/5 p-4"
          >
            <button
              type="button"
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500 py-2.5 text-sm font-semibold text-[#0C0A08] transition-colors hover:bg-amber-400"
            >
              <ChevronRight className="h-3.5 w-3.5" />
              View {phase.idea.name}
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="text-[11px] font-mono text-zinc-700 transition-colors hover:text-zinc-400"
            >
              build another
            </button>
          </motion.div>
        )}
        {phase.type === "building" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-shrink-0 border-t border-white/5 px-4 pb-3 pt-3"
          >
            <button
              type="button"
              onClick={handleReset}
              className="w-full text-[11px] font-mono text-zinc-700 transition-colors hover:text-red-400"
            >
              cancel build
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
