import { HeroSection } from "@/components/landing/HeroSection";
import { SentimentTicker } from "@/components/landing/SentimentTicker";
import { BentoGrid } from "@/components/landing/BentoGrid";

export default function LandingPage() {
  return (
    <div className="flex flex-col">
      {/* Hero with Sentiment Pulse */}
      <HeroSection />

      {/* Live marquee ticker */}
      <SentimentTicker />

      {/* Generative Bento Grid */}
      <BentoGrid />

      {/* Footer */}
      <footer className="border-t border-white/6 py-8 px-4 text-center">
        <p className="text-xs font-mono text-zinc-700">
          BullishForge · Built at hackathon speed · Powered by real-time sentiment
        </p>
      </footer>
    </div>
  );
}
