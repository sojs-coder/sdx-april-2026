"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useSentiment } from "@/hooks/useSentiment";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { ExternalLink, Play, RefreshCw, Sparkles } from "lucide-react";

const GENERATED_APPS = [
  { id: "app_001", name: "Bullish Dashboard v2", ticker: "BTC", status: "ready",      sentiment: 0.72 },
  { id: "app_002", name: "ETH Sentiment Tracker", ticker: "ETH", status: "generating", sentiment: 0.51 },
  { id: "app_003", name: "Alpha Signal Feed",     ticker: "SOL", status: "ready",      sentiment: 0.88 },
];

const CODE_LINES = [
  { indent: 0, text: "export function SentimentApp() {",       color: "text-amber-500" },
  { indent: 1, text: "const { signals, metrics } = useSentiment();", color: "text-zinc-400" },
  { indent: 0, text: "",                                         color: "" },
  { indent: 1, text: "return (",                                color: "text-zinc-600" },
  { indent: 2, text: '<Dashboard theme="bullish">',            color: "text-amber-400/70" },
  { indent: 3, text: "<SignalFeed signals={signals} />",        color: "text-zinc-400" },
  { indent: 3, text: "<AlphaChart data={metrics} />",           color: "text-zinc-400" },
  { indent: 2, text: "</Dashboard>",                            color: "text-amber-400/70" },
  { indent: 1, text: ");",                                      color: "text-zinc-600" },
  { indent: 0, text: "}",                                       color: "text-amber-500" },
];

function AppCard({ app, isActive, onClick }: { app: typeof GENERATED_APPS[0]; isActive: boolean; onClick: () => void }) {
  return (
    <motion.button
      layout
      onClick={onClick}
      className={cn(
        "w-full text-left px-3 py-2.5 rounded-lg border transition-all duration-150",
        isActive ? "bg-amber-500/6 border-amber-500/20" : "border-transparent hover:bg-white/3 hover:border-white/8"
      )}
      whileTap={{ scale: 0.99 }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {app.status === "generating" ? (
            <RefreshCw className="w-3 h-3 text-amber-600 animate-spin flex-shrink-0" />
          ) : (
            <div className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
          )}
          <span className="text-xs text-white/80 truncate">{app.name}</span>
          <span className="text-[10px] font-mono text-zinc-700 flex-shrink-0">{app.ticker}</span>
        </div>
        <span className="text-xs font-bold font-mono text-amber-400 flex-shrink-0">
          +{(app.sentiment * 100).toFixed(0)}%
        </span>
      </div>
    </motion.button>
  );
}

export function ForgeCanvas() {
  const { metrics } = useSentiment({ interval: 2200 });
  const [activeApp, setActiveApp] = useState(GENERATED_APPS[0].id);
  const currentApp = GENERATED_APPS.find((a) => a.id === activeApp) ?? GENERATED_APPS[0];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/5 flex-shrink-0">
        <span className="text-xs font-medium text-white/80">Forge</span>
        <button className="text-[10px] font-mono text-zinc-600 hover:text-amber-500 transition-colors flex items-center gap-1">
          <Sparkles className="w-3 h-3" />
          Generate
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        {GENERATED_APPS.map((app) => (
          <AppCard key={app.id} app={app} isActive={activeApp === app.id} onClick={() => setActiveApp(app.id)} />
        ))}
      </div>

      {/* Code preview */}
      <div className="border-t border-white/5 flex-shrink-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeApp}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex items-center gap-2 px-3 py-1.5 border-b border-white/4">
              <div className="flex gap-1">
                <div className="w-2 h-2 rounded-full bg-red-500/60" />
                <div className="w-2 h-2 rounded-full bg-amber-500/60" />
                <div className="w-2 h-2 rounded-full bg-green-500/40" />
              </div>
              <span className="text-[10px] font-mono text-zinc-700">
                {currentApp.name.replace(/\s+/g, "").toLowerCase()}.tsx
              </span>
            </div>
            <div className="bg-[#0C0A08] p-3 font-mono text-[11px] space-y-0.5">
              {CODE_LINES.map((line, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                  className="flex"
                >
                  <span className="text-zinc-800 w-5 text-right mr-3 select-none">{i + 1}</span>
                  <span className={cn("whitespace-pre", line.color)} style={{ paddingLeft: `${line.indent * 14}px` }}>
                    {line.text}
                  </span>
                </motion.div>
              ))}
              <div className="flex">
                <span className="text-zinc-800 w-5 text-right mr-3">{CODE_LINES.length + 1}</span>
                <span className="text-amber-500 animate-blink">█</span>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex gap-2 p-3 border-t border-white/5 flex-shrink-0">
        <button className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/15 text-amber-400 text-xs font-medium hover:bg-amber-500/15 transition-colors">
          <Play className="w-3 h-3" />
          Preview
        </button>
        <button className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg glass border border-white/6 text-zinc-500 text-xs hover:text-white transition-colors">
          <ExternalLink className="w-3 h-3" />
          Deploy
        </button>
      </div>
    </div>
  );
}
