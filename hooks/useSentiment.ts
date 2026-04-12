"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export type SentimentDirection = "bullish" | "bearish" | "neutral";

export interface SentimentSignal {
  id: string;
  ticker: string;
  score: number;          // -1 to +1
  direction: SentimentDirection;
  source: string;
  message: string;
  timestamp: Date;
  velocity: number;       // rate-of-change
  volume: number;         // relative volume 0–100
}

export interface SentimentMetrics {
  overallScore: number;
  bullishCount: number;
  bearishCount: number;
  neutralCount: number;
  velocityHistory: { time: string; velocity: number; score: number }[];
  dominantTicker: string;
  pulseIntensity: number; // 0–1, drives animation amplitude
}

const TICKERS = ["BTC", "ETH", "SOL", "NVDA", "AAPL", "TSLA", "MSFT", "META", "FORGE", "ARB"];
const SOURCES = ["Reddit/r/wallstreetbets", "Twitter/X", "Discord Signal", "Telegram Alpha", "Dark Pool", "Options Flow", "Whale Alert", "On-Chain Metric"];
const MESSAGES = {
  bullish: [
    "Massive accumulation detected in whale wallets",
    "Options chain showing unusual call volume",
    "RSI breakout confirmed on 4H timeframe",
    "Sentiment inflection point — smart money buying",
    "Volume spike +340% above 30-day average",
    "Institutional accumulation phase detected",
    "Golden cross forming on daily chart",
  ],
  bearish: [
    "Distribution pattern emerging — proceed with caution",
    "Whale wallets showing significant net outflows",
    "Put/Call ratio spiking — fear in the market",
    "Macro headwinds — risk-off sentiment spreading",
    "Death cross approaching on 4H",
  ],
  neutral: [
    "Consolidating in key range — watching for breakout",
    "Mixed signals — await confirmation",
    "Low-conviction environment, reduce position size",
  ],
};

function generateSignal(): SentimentSignal {
  const rand = Math.random();
  const direction: SentimentDirection =
    rand > 0.55 ? "bullish" : rand > 0.25 ? "bearish" : "neutral";
  const ticker = TICKERS[Math.floor(Math.random() * TICKERS.length)];
  const source = SOURCES[Math.floor(Math.random() * SOURCES.length)];
  const msgArr = MESSAGES[direction];
  const message = msgArr[Math.floor(Math.random() * msgArr.length)];
  const score =
    direction === "bullish"
      ? Math.random() * 0.5 + 0.5
      : direction === "bearish"
      ? -(Math.random() * 0.5 + 0.5)
      : (Math.random() - 0.5) * 0.3;

  return {
    id: `sig_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    ticker,
    score: parseFloat(score.toFixed(3)),
    direction,
    source,
    message,
    timestamp: new Date(),
    velocity: parseFloat((Math.random() * 2 - 1).toFixed(3)),
    volume: Math.floor(Math.random() * 100),
  };
}

function computeMetrics(signals: SentimentSignal[]): SentimentMetrics {
  if (!signals.length) {
    return {
      overallScore: 0,
      bullishCount: 0,
      bearishCount: 0,
      neutralCount: 0,
      velocityHistory: [],
      dominantTicker: "—",
      pulseIntensity: 0,
    };
  }
  const recent = signals.slice(0, 40);
  const bullishCount = recent.filter((s) => s.direction === "bullish").length;
  const bearishCount = recent.filter((s) => s.direction === "bearish").length;
  const neutralCount = recent.filter((s) => s.direction === "neutral").length;
  const overallScore =
    recent.reduce((acc, s) => acc + s.score, 0) / recent.length;

  // Velocity sparkline (last 20 points, grouped into buckets)
  const velocityHistory = Array.from({ length: 20 }, (_, i) => {
    const bucket = recent.slice(i * 2, i * 2 + 2);
    const avgVel = bucket.length
      ? bucket.reduce((a, b) => a + b.velocity, 0) / bucket.length
      : 0;
    const avgScore = bucket.length
      ? bucket.reduce((a, b) => a + b.score, 0) / bucket.length
      : 0;
    return {
      time: `T-${(20 - i) * 30}s`,
      velocity: parseFloat(avgVel.toFixed(3)),
      score: parseFloat(avgScore.toFixed(3)),
    };
  });

  // Dominant ticker by frequency
  const tickerFreq: Record<string, number> = {};
  recent.forEach((s) => {
    tickerFreq[s.ticker] = (tickerFreq[s.ticker] || 0) + 1;
  });
  const dominantTicker = Object.entries(tickerFreq).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";

  const pulseIntensity = Math.min(1, Math.abs(overallScore) * 1.5);

  return {
    overallScore: parseFloat(overallScore.toFixed(4)),
    bullishCount,
    bearishCount,
    neutralCount,
    velocityHistory,
    dominantTicker,
    pulseIntensity,
  };
}

export function useSentiment(
  options: { interval?: number; maxSignals?: number } = {}
) {
  const { interval = 2200, maxSignals = 60 } = options;
  const [signals, setSignals] = useState<SentimentSignal[]>(() =>
    Array.from({ length: 8 }, generateSignal)
  );
  const [metrics, setMetrics] = useState<SentimentMetrics>(() =>
    computeMetrics([])
  );
  const [connected, setConnected] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pushSignal = useCallback(() => {
    setSignals((prev) => {
      const next = [generateSignal(), ...prev].slice(0, maxSignals);
      setMetrics(computeMetrics(next));
      return next;
    });
  }, [maxSignals]);

  useEffect(() => {
    // Simulate WebSocket handshake delay
    const connectTimeout = setTimeout(() => {
      setConnected(true);
      timerRef.current = setInterval(pushSignal, interval);
    }, 800);

    return () => {
      clearTimeout(connectTimeout);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [interval, pushSignal]);

  // Initial metrics from seed signals
  useEffect(() => {
    setMetrics(computeMetrics(signals));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { signals, metrics, connected };
}
