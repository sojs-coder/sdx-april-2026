"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CommandPalette } from "@/components/CommandPalette";
import { cn } from "@/lib/utils";
import { Zap } from "lucide-react";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/dashboard", label: "Dashboard" },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <motion.header
      initial={{ y: -16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.35 }}
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 md:px-6 h-11 border-b border-amber-500/10 bg-[#0C0A08]/90 backdrop-blur-xl"
    >
      <Link href="/" className="flex items-center gap-2 group">
        <div className="w-5 h-5 rounded flex items-center justify-center">
          <Zap className="w-4 h-4 text-amber-500" />
        </div>
        <span className="text-sm font-bold text-white tracking-tight">
          Bullish<span className="text-amber-500">Forge</span>
        </span>
      </Link>

      <nav className="hidden md:flex items-center gap-0.5">
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "relative px-3 py-1 rounded text-xs font-medium transition-colors duration-150",
              pathname === link.href ? "text-white" : "text-zinc-500 hover:text-zinc-300"
            )}
          >
            {pathname === link.href && (
              <motion.div
                layoutId="nav-pill"
                className="absolute inset-0 bg-white/5 rounded"
                transition={{ type: "spring", bounce: 0.15, duration: 0.35 }}
              />
            )}
            <span className="relative z-10">{link.label}</span>
          </Link>
        ))}
      </nav>

      <CommandPalette />
    </motion.header>
  );
}
