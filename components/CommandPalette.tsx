"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import {
  BarChart3,
  Home,
  Layers,
  Settings,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Zap,
  Activity,
  Globe,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_COMMANDS = [
  { label: "Go to Landing", icon: Home, path: "/", shortcut: "G L" },
  { label: "Open Dashboard", icon: BarChart3, path: "/dashboard", shortcut: "G D" },
];

const ACTION_COMMANDS = [
  { label: "Forge New App", icon: Sparkles, action: "forge", shortcut: "⌘N" },
  { label: "Refresh Signal Feed", icon: RefreshCw, action: "refresh", shortcut: "⌘R" },
  { label: "View Bullish Signals", icon: TrendingUp, action: "bullish" },
  { label: "View Bearish Signals", icon: TrendingDown, action: "bearish" },
  { label: "Global Sentiment Map", icon: Globe, action: "map" },
];

const DATA_COMMANDS = [
  { label: "BTC Sentiment", icon: Activity, ticker: "BTC" },
  { label: "ETH Sentiment", icon: Activity, ticker: "ETH" },
  { label: "SOL Sentiment", icon: Activity, ticker: "SOL" },
  { label: "NVDA Sentiment", icon: Activity, ticker: "NVDA" },
  { label: "FORGE Sentiment", icon: Zap, ticker: "FORGE" },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [recentlyRun, setRecentlyRun] = useState<string | null>(null);
  const router = useRouter();

  const toggle = useCallback(() => setOpen((o) => !o), []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || e.key === "/") {
        e.preventDefault();
        toggle();
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [toggle]);

  const runAction = (label: string, fn: () => void) => {
    setRecentlyRun(label);
    fn();
    setOpen(false);
    setTimeout(() => setRecentlyRun(null), 1500);
  };

  return (
    <>
      {/* Trigger button (also accessible via Cmd+K) */}
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded glass border border-amber-500/10 text-zinc-500 text-xs font-mono hover:text-zinc-300 hover:border-amber-500/20 transition-all duration-150"
      >
        <kbd className="text-[10px] font-mono">⌘K</kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <div
          className="rounded-xl overflow-hidden"
          style={{
            background: "rgba(12,10,8,0.97)",
            backdropFilter: "blur(24px)",
            border: "1px solid rgba(245,158,11,0.12)",
            boxShadow: "0 0 40px rgba(245,158,11,0.06), 0 24px 64px rgba(0,0,0,0.7)",
          }}
        >
          <div className="flex items-center gap-2 px-4 py-1.5 border-b border-amber-500/8">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-[10px] font-mono text-zinc-700 tracking-widest">
              BULLISHFORGE
            </span>
          </div>

          <CommandInput
            placeholder="Search commands, tickers, actions..."
            className="border-b border-white/8 bg-transparent text-sm font-mono text-white placeholder:text-zinc-700"
          />

          <CommandList className="max-h-[320px] overflow-y-auto">
            <CommandEmpty className="text-center py-8 text-sm font-mono text-zinc-700">
              No signals found.
            </CommandEmpty>

            {/* Navigation */}
            <CommandGroup
              heading={
                <span className="text-[10px] font-mono text-zinc-700 uppercase tracking-widest px-1">
                  Navigation
                </span>
              }
            >
              {NAV_COMMANDS.map((cmd) => {
                const Icon = cmd.icon;
                return (
                  <CommandItem
                    key={cmd.label}
                    onSelect={() => runAction(cmd.label, () => router.push(cmd.path))}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer text-zinc-300 hover:text-white data-[selected=true]:bg-white/6 data-[selected=true]:text-white"
                  >
                    <div className="w-6 h-6 rounded-md bg-white/5 flex items-center justify-center">
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-sm">{cmd.label}</span>
                    {cmd.shortcut && (
                      <CommandShortcut className="text-[10px] font-mono text-zinc-700">
                        {cmd.shortcut}
                      </CommandShortcut>
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>

            <CommandSeparator className="bg-white/6 my-1" />

            {/* Actions */}
            <CommandGroup
              heading={
                <span className="text-[10px] font-mono text-zinc-700 uppercase tracking-widest px-1">
                  Actions
                </span>
              }
            >
              {ACTION_COMMANDS.map((cmd) => {
                const Icon = cmd.icon;
                const isForge = cmd.action === "forge";
                return (
                  <CommandItem
                    key={cmd.label}
                    onSelect={() => runAction(cmd.label, () => {})}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer text-zinc-300 hover:text-white data-[selected=true]:bg-white/6 data-[selected=true]:text-white"
                  >
                    <div
                      className={cn(
                        "w-6 h-6 rounded-md flex items-center justify-center",
                        isForge ? "bg-amber-500/12" : "bg-white/4"
                      )}
                    >
                      <Icon className={cn("w-3.5 h-3.5", isForge ? "text-amber-500" : "")} />
                    </div>
                    <span className="text-sm">{cmd.label}</span>
                    {cmd.shortcut && (
                      <CommandShortcut className="text-[10px] font-mono text-zinc-700">
                        {cmd.shortcut}
                      </CommandShortcut>
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>

            <CommandSeparator className="bg-white/6 my-1" />

            {/* Data */}
            <CommandGroup
              heading={
                <span className="text-[10px] font-mono text-zinc-700 uppercase tracking-widest px-1">
                  Ticker Signals
                </span>
              }
            >
              {DATA_COMMANDS.map((cmd) => {
                const Icon = cmd.icon;
                return (
                  <CommandItem
                    key={cmd.ticker}
                    onSelect={() => runAction(cmd.label, () => {})}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer text-zinc-300 hover:text-white data-[selected=true]:bg-white/6 data-[selected=true]:text-white"
                  >
                    <div className="w-6 h-6 rounded-md bg-amber-500/8 flex items-center justify-center">
                      <Icon className="w-3.5 h-3.5 text-amber-500/70" />
                    </div>
                    <span className="text-sm">{cmd.label}</span>
                    <span className="ml-auto text-[10px] font-mono text-zinc-700">
                      {cmd.ticker}
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-2 border-t border-white/6">
            <span className="text-[10px] font-mono text-zinc-800">
              {recentlyRun ? (
                <span className="text-amber-500/70">✓ {recentlyRun}</span>
              ) : (
                "ESC to close"
              )}
            </span>
            <div className="flex items-center gap-3">
              {[
                { key: "↑↓", label: "navigate" },
                { key: "↵", label: "select" },
                { key: "ESC", label: "close" },
              ].map((hint) => (
                <div key={hint.key} className="flex items-center gap-1">
                  <kbd className="text-[9px] px-1 py-0.5 rounded border border-white/10 bg-white/5 font-mono text-zinc-600">
                    {hint.key}
                  </kbd>
                  <span className="text-[10px] text-zinc-800">{hint.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CommandDialog>
    </>
  );
}
