"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { SignInButton, UserButton, useUser } from "@clerk/nextjs";
import { useLang } from "@/contexts/LangContext";
import LangToggle from "./LangToggle";

export type Tab = "generator" | "history" | "sniper";

interface NavigationProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

const TABS: { id: Tab; label: string; pro?: boolean }[] = [
  { id: "generator", label: "Generator" },
  { id: "history", label: "History" },
  { id: "sniper", label: "Sniper", pro: true },
];

export default function Navigation({ activeTab, onTabChange }: NavigationProps) {
  const { uiLang, setUiLang, t } = useLang();
  const { isSignedIn, isLoaded } = useUser();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/[0.06] bg-bg/90 backdrop-blur-md">
      <div className="max-w-[800px] mx-auto px-4 h-14 flex items-center justify-between">
        <Link
          href="/"
          className="font-extrabold text-base tracking-tight text-white select-none hover:text-white/80 transition-colors"
        >
          Resellr AI
        </Link>

        <div className="flex items-center gap-2 md:gap-3">
          {/* Desktop tab pills */}
          <div className="hidden md:flex items-center gap-1 bg-surface rounded-pill p-1 border border-white/[0.06]">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className="relative px-5 py-1.5 rounded-pill text-sm font-bold transition-colors duration-150 focus:outline-none flex items-center gap-1.5"
              >
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 bg-green/10 border border-green rounded-pill"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                  />
                )}
                <span
                  className={`relative z-10 transition-colors duration-150 ${
                    activeTab === tab.id
                      ? "text-green"
                      : "text-text-muted hover:text-text-secondary"
                  }`}
                >
                  {tab.label}
                </span>
                {tab.pro && (
                  <span className="relative z-10 text-[9px] font-extrabold px-1.5 py-0.5 rounded-full bg-green/10 border border-green/30 text-green leading-none">
                    PRO
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* UI language toggle */}
          <LangToggle value={uiLang} onChange={setUiLang} />

          {/* Buy credits — visible for every signed-in user (incl. unlimited) */}
          {isLoaded && isSignedIn && (
            <Link
              href="/pricing"
              className="text-xs font-extrabold text-bg bg-green rounded-pill px-3 py-1.5 hover:bg-green/90 transition-colors whitespace-nowrap"
            >
              {t.buyCredits}
            </Link>
          )}

          {/* Auth — conditional on load state */}
          {isLoaded && !isSignedIn && (
            <SignInButton mode="modal">
              <button className="text-xs font-bold text-text-secondary hover:text-white border border-white/[0.12] rounded-pill px-3.5 py-1.5 hover:border-white/30 transition-all">
                Sign in
              </button>
            </SignInButton>
          )}
          {isLoaded && isSignedIn && (
            <UserButton
              appearance={{
                elements: {
                  avatarBox: "w-7 h-7",
                  userButtonPopoverCard:
                    "bg-surface border border-white/[0.10] shadow-xl",
                  userButtonPopoverActionButton:
                    "text-text-secondary hover:text-white",
                },
              }}
            />
          )}
        </div>
      </div>
    </nav>
  );
}
