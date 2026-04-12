"use client";

import { motion, type Variants } from "framer-motion";
import { useSentiment } from "@/hooks/useSentiment";
import { cn } from "@/lib/utils";
import { Globe, Lock, Rocket, TrendingUp, Zap } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area } from "recharts";

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.45, ease: "easeOut" as const },
  }),
};

function MiniChart({ data }: { data: { score: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={48}>
      <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="score" stroke="#F59E0B" strokeWidth={1.5} fill="url(#sg)" dot={false} activeDot={false} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

const FEATURES = [
  { icon: Zap,    title: "Instant generation",    body: "Signal to scaffold in under 3s.",   accent: "#F59E0B" },
  { icon: Globe,  title: "Multi-source",           body: "Reddit, X, Discord, on-chain.",     accent: "#FBBF24" },
  { icon: Lock,   title: "Non-custodial",          body: "Your signals stay yours.",           accent: "#D97706" },
  { icon: Rocket, title: "One-click deploy",       body: "Vercel, Netlify, or self-host.",    accent: "#F59E0B" },
];

export function BentoGrid() {
  const { metrics } = useSentiment({ interval: 3000 });
  const total = metrics.bullishCount + metrics.bearishCount + metrics.neutralCount;

  return (
    <section className="px-4 py-16 max-w-5xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 auto-rows-auto">

        {/* Live score tile — spans 2 rows */}
        <motion.div
          custom={0}
          variants={cardVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="md:row-span-2 glass rounded-xl p-5 flex flex-col gap-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-medium text-white">Live Score</span>
            </div>
            <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
          </div>

          <div>
            <div className={cn("text-4xl font-bold font-mono tabular-nums", metrics.overallScore >= 0 ? "text-amber-400" : "text-red-400")}>
              {metrics.overallScore >= 0 ? "+" : ""}{(metrics.overallScore * 100).toFixed(1)}
            </div>
          </div>

          <MiniChart data={metrics.velocityHistory} />

          <div className="space-y-2">
            {[
              { label: "Bull", value: metrics.bullishCount, color: "#F59E0B" },
              { label: "Bear", value: metrics.bearishCount, color: "#EF4444" },
            ].map((bar) => (
              <div key={bar.label} className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-zinc-700 w-6">{bar.label}</span>
                <div className="flex-1 h-0.5 rounded-full bg-white/5 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: bar.color }}
                    animate={{ width: total > 0 ? `${(bar.value / total) * 100}%` : "0%" }}
                    transition={{ duration: 0.6 }}
                  />
                </div>
                <span className="text-[10px] font-mono text-zinc-600 w-4 text-right">{bar.value}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Feature tiles */}
        {FEATURES.map((f, i) => {
          const Icon = f.icon;
          return (
            <motion.div
              key={f.title}
              custom={i + 1}
              variants={cardVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className="glass rounded-xl p-4 flex flex-col gap-2.5 group hover:border-amber-500/15 transition-colors duration-200"
            >
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${f.accent}12` }}>
                <Icon className="w-3.5 h-3.5" style={{ color: f.accent }} />
              </div>
              <div>
                <h3 className="text-xs font-semibold text-white">{f.title}</h3>
                <p className="text-[11px] text-zinc-600 mt-0.5">{f.body}</p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
