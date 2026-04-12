"use client";

import { useSentiment } from "@/hooks/useSentiment";
import { cn } from "@/lib/utils";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { motion } from "framer-motion";

function CustomTooltip({ active, payload }: { active?: boolean; payload?: { value: number }[] }) {
  if (!active || !payload?.length) return null;
  const v = payload[0].value;
  return (
    <div className="glass border border-white/8 rounded px-2 py-1 text-[10px] font-mono">
      <span className={v > 0 ? "text-amber-400" : "text-red-400"}>
        {v > 0 ? "+" : ""}{v.toFixed(3)}
      </span>
    </div>
  );
}

export function AlphaMetrics() {
  const { metrics, signals } = useSentiment({ interval: 2200 });

  const regime = metrics.overallScore > 0.1 ? "BULL" : metrics.overallScore < -0.1 ? "BEAR" : "—";
  const regimeColor = regime === "BULL" ? "text-amber-400" : regime === "BEAR" ? "text-red-400" : "text-zinc-600";

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/5 flex-shrink-0">
        <span className="text-xs font-medium text-white/80">Metrics</span>
        <span className={cn("text-[11px] font-mono font-bold", regimeColor)}>{regime}</span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Score + counts */}
        <div className="grid grid-cols-2 gap-2">
          {[
            {
              label: "Score",
              value: `${metrics.overallScore > 0 ? "+" : ""}${(metrics.overallScore * 100).toFixed(1)}%`,
              color: metrics.overallScore > 0 ? "text-amber-400" : "text-red-400",
            },
            {
              label: "Ticker",
              value: metrics.dominantTicker,
              color: "text-white",
            },
            {
              label: "Bullish",
              value: String(metrics.bullishCount),
              color: "text-amber-400",
            },
            {
              label: "Bearish",
              value: String(metrics.bearishCount),
              color: "text-red-400",
            },
          ].map((s) => (
            <div key={s.label} className="glass rounded-lg p-2.5">
              <div className="text-[10px] font-mono text-zinc-700 mb-0.5">{s.label}</div>
              <div className={cn("text-base font-bold font-mono tabular-nums", s.color)}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Velocity chart */}
        <div className="glass rounded-xl p-3">
          <div className="text-[10px] font-mono text-zinc-700 mb-2">Velocity</div>
          <ResponsiveContainer width="100%" height={110}>
            <AreaChart data={metrics.velocityHistory} margin={{ top: 4, right: 4, bottom: 0, left: -30 }}>
              <defs>
                <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#F59E0B" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.03)" />
              <XAxis
                dataKey="time"
                tick={{ fill: "#3a3028", fontSize: 7, fontFamily: "var(--font-geist-mono)" }}
                tickLine={false}
                axisLine={false}
                interval={4}
              />
              <YAxis
                tick={{ fill: "#3a3028", fontSize: 7, fontFamily: "var(--font-geist-mono)" }}
                tickLine={false}
                axisLine={false}
                domain={[-1, 1]}
              />
              <ReferenceLine y={0} stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="score"
                stroke="#F59E0B"
                strokeWidth={1.5}
                fill="url(#ag)"
                dot={false}
                activeDot={{ r: 2.5, fill: "#F59E0B", strokeWidth: 0 }}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Pulse bar */}
        <div className="glass rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono text-zinc-700">Pulse</span>
            <span className="text-[10px] font-mono text-amber-500/70">
              {(metrics.pulseIntensity * 100).toFixed(0)}%
            </span>
          </div>
          <div className="h-1 rounded-full bg-white/4 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-amber-500"
              style={{ boxShadow: `0 0 6px rgba(245,158,11,${metrics.pulseIntensity * 0.5})` }}
              animate={{ width: `${metrics.pulseIntensity * 100}%` }}
              transition={{ duration: 0.8 }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
