"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useSentiment } from "@/hooks/useSentiment";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { ExternalLink, RefreshCw } from "lucide-react";

const APPS = [
  { id: "a1", name: "Bullish Dashboard v2",  ticker: "BTC", status: "ready",      sentiment: 0.72 },
  { id: "a2", name: "ETH Sentiment Tracker", ticker: "ETH", status: "generating", sentiment: 0.51 },
  { id: "a3", name: "Alpha Signal Feed",     ticker: "SOL", status: "ready",      sentiment: 0.88 },
];

const CODE: { t: string; c: string; i: number }[] = [
  { i: 0, t: "export function SentimentApp() {",       c: "text-amber-500" },
  { i: 1, t: "const { signals, metrics } = useSentiment();", c: "text-zinc-400" },
  { i: 0, t: "",                                         c: "" },
  { i: 1, t: "return (",                                c: "text-zinc-600" },
  { i: 2, t: '<Dashboard theme="bullish">',            c: "text-amber-400/60" },
  { i: 3, t: "<SignalFeed signals={signals} />",        c: "text-zinc-500" },
  { i: 3, t: "<AlphaChart data={metrics} />",           c: "text-zinc-500" },
  { i: 2, t: "</Dashboard>",                            c: "text-amber-400/60" },
  { i: 1, t: ");",                                      c: "text-zinc-600" },
  { i: 0, t: "}",                                       c: "text-amber-500" },
];

export function ForgeCanvas() {
  const { metrics } = useSentiment({ interval: 2200 });
  const [active, setActive] = useState(APPS[0].id);
  const current = APPS.find((a) => a.id === active) ?? APPS[0];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* App list */}
      <div className="flex-shrink-0 p-3 space-y-px">
        {APPS.map((app) => (
          <button
            key={app.id}
            onClick={() => setActive(app.id)}
            className={cn(
              "w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors duration-150",
              active === app.id ? "bg-amber-500/6" : "hover:bg-white/3"
            )}
          >
            <div className="flex items-center gap-2 min-w-0">
              {app.status === "generating"
                ? <RefreshCw className="w-2.5 h-2.5 text-amber-600 animate-spin flex-shrink-0" />
                : <div className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", active === app.id ? "bg-amber-500" : "bg-zinc-700")} />
              }
              <span className="text-xs text-white/80 truncate">{app.name}</span>
              <span className="text-[10px] font-mono text-zinc-700 flex-shrink-0">{app.ticker}</span>
            </div>
            <span className="text-xs font-bold font-mono text-amber-400 flex-shrink-0 ml-2">
              +{(app.sentiment * 100).toFixed(0)}%
            </span>
          </button>
        ))}
      </div>

      {/* Code preview — no chrome, just the code */}
      <div className="flex-1 overflow-hidden border-t border-white/5">
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="p-4 font-mono text-[11px] space-y-0.5 h-full overflow-y-auto"
          >
            {CODE.map((line, i) => (
              <div key={i} className="flex">
                <span
                  className={cn("whitespace-pre", line.c)}
                  style={{ paddingLeft: `${line.i * 14}px` }}
                >
                  {line.t}
                </span>
              </div>
            ))}
            <div>
              <span className="text-amber-500 animate-blink">█</span>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Single action */}
      <div className="flex-shrink-0 p-3 border-t border-white/5">
        <button className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-amber-500/10 border border-amber-500/15 text-amber-400 text-xs font-medium hover:bg-amber-500/15 transition-colors">
          <ExternalLink className="w-3 h-3" />
          Deploy {current.ticker}
        </button>
      </div>
    </div>
  );
}
