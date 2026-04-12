"use client";

import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useSentiment } from "@/hooks/useSentiment";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

// Three.js cannot run on the server — dynamic import kills SSR for this component only.
const ForgeScene = dynamic(
  () => import("./ForgeScene").then((m) => m.ForgeScene),
  { ssr: false }
);

function AnimatedCount({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const start = display;
    const startTime = Date.now();
    const frame = () => {
      const p = Math.min((Date.now() - startTime) / 500, 1);
      setDisplay(Math.round(start + (value - start) * p));
      if (p < 1) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return <>{display}</>;
}

export function HeroSection() {
  const { metrics, connected } = useSentiment({ interval: 2200 });

  const sentimentColor =
    metrics.overallScore > 0.1 ? "text-amber-400" : metrics.overallScore < -0.1 ? "text-red-400" : "text-zinc-500";

  const sentimentLabel =
    metrics.overallScore > 0.2
      ? "EXTREME BULL"
      : metrics.overallScore > 0
      ? "BULLISH"
      : metrics.overallScore < -0.2
      ? "EXTREME BEAR"
      : "NEUTRAL";

  return (
    <section className="relative min-h-screen flex items-center px-4 pt-16 pb-12 overflow-hidden">
      {/* Subtle grid */}
      <div
        className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage: `linear-gradient(rgba(245,158,11,1) 1px, transparent 1px), linear-gradient(90deg, rgba(245,158,11,1) 1px, transparent 1px)`,
          backgroundSize: "48px 48px",
        }}
      />
      {/* Radial vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_20%,#0C0A08_72%)] pointer-events-none" />

      <div className="relative z-10 flex flex-col lg:flex-row items-center gap-8 max-w-5xl w-full mx-auto">

        {/* ── Text ── */}
        <div className="flex-1 flex flex-col gap-7">
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-5xl md:text-6xl font-bold tracking-tight leading-[1.06] text-white"
          >
            Forge at the speed
            <br />
            of{" "}
            <span className="text-amber-400 glow-text">sentiment.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.5 }}
            className="text-base text-zinc-500 max-w-sm leading-relaxed"
          >
            Real-time signal aggregation that turns bullish momentum into deployable apps.
          </motion.p>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="flex items-center gap-5"
          >
            {[
              { label: "Bullish", value: metrics.bullishCount, color: "text-amber-400" },
              { label: "Total", value: metrics.bullishCount + metrics.bearishCount + metrics.neutralCount, color: "text-white" },
            ].map((s) => (
              <div key={s.label}>
                <div className={cn("text-2xl font-bold font-mono tabular-nums", s.color)}>
                  <AnimatedCount value={s.value} />
                </div>
                <div className="text-[10px] text-zinc-600 uppercase tracking-widest mt-0.5">{s.label}</div>
              </div>
            ))}
            <div className="h-8 w-px bg-white/8" />
            <div>
              <div className={cn("text-sm font-mono font-bold tracking-widest", sentimentColor)}>
                {sentimentLabel}
              </div>
              <div className="text-[10px] text-zinc-700 mt-0.5">
                {connected ? "live" : "connecting"}
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
          >
            <Link
              href="/dashboard"
              className="group inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-amber-500 text-[#0C0A08] font-semibold text-sm hover:bg-amber-400 transition-colors glow"
            >
              Open Dashboard
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </motion.div>
        </div>

        {/* ── Three.js Forge Scene ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 1 }}
          className="flex-shrink-0 w-[340px] h-[340px] md:w-[460px] md:h-[460px] lg:w-[500px] lg:h-[500px]"
        >
          <ForgeScene intensity={metrics.pulseIntensity} />
        </motion.div>
      </div>
    </section>
  );
}
