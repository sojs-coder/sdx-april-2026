"use client";

import { useSentiment } from "@/hooks/useSentiment";
import { cn } from "@/lib/utils";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  YAxis,
  ReferenceLine,
  Tooltip,
} from "recharts";
import { motion } from "framer-motion";

function CustomTooltip({ active, payload }: { active?: boolean; payload?: { value: number }[] }) {
  if (!active || !payload?.length) return null;
  const v = payload[0].value;
  return (
    <div className="px-2 py-1 text-[10px] font-mono bg-[#0C0A08] border border-white/8 rounded">
      <span className={v > 0 ? "text-amber-400" : "text-red-400"}>
        {v > 0 ? "+" : ""}{v.toFixed(3)}
      </span>
    </div>
  );
}

export function AlphaMetrics() {
  const { metrics } = useSentiment({ interval: 2200 });
  const isBull = metrics.overallScore > 0;
  const scoreColor = isBull ? "text-amber-400" : "text-red-400";

  return (
    <div className="flex flex-col h-full overflow-hidden p-3 gap-4">
      {/* Score + counts — no cards, just text */}
      <div className="flex-shrink-0">
        <div className={cn("text-3xl font-bold font-mono tabular-nums", scoreColor)}>
          {isBull ? "+" : ""}{(metrics.overallScore * 100).toFixed(1)}
        </div>
        <div className="flex items-center gap-3 mt-1">
          <span className="text-[11px] font-mono text-amber-400/70">
            {metrics.bullishCount} bull
          </span>
          <span className="text-[11px] font-mono text-red-400/60">
            {metrics.bearishCount} bear
          </span>
        </div>
      </div>

      {/* Velocity chart — no wrapper, no label */}
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={metrics.velocityHistory} margin={{ top: 4, right: 2, bottom: 0, left: -38 }}>
            <defs>
              <linearGradient id="ag2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#F59E0B" stopOpacity={0.18} />
                <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
              </linearGradient>
            </defs>
            <YAxis
              tick={{ fill: "#2a2018", fontSize: 7, fontFamily: "var(--font-geist-mono)" }}
              tickLine={false}
              axisLine={false}
              domain={[-1, 1]}
            />
            <ReferenceLine y={0} stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="score"
              stroke="#F59E0B"
              strokeWidth={1.5}
              fill="url(#ag2)"
              dot={false}
              activeDot={{ r: 2, fill: "#F59E0B", strokeWidth: 0 }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Pulse — single line, no card */}
      <div className="flex-shrink-0 pb-1">
        <div className="h-0.5 rounded-full bg-white/4 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-amber-500"
            animate={{ width: `${metrics.pulseIntensity * 100}%` }}
            transition={{ duration: 0.8 }}
          />
        </div>
      </div>
    </div>
  );
}
