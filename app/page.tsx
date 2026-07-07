"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Navigation, { Tab } from "@/components/Navigation";
import ProgressBar from "@/components/ProgressBar";
import GeneratorView from "@/components/GeneratorView";
import HistoryView from "@/components/HistoryView";
import SniperFeed from "@/components/SniperFeed";

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("generator");
  const [isLoading, setIsLoading] = useState(false);

  return (
    <>
      <Navigation activeTab={activeTab} onTabChange={setActiveTab} />
      <ProgressBar isLoading={isLoading} />

      <div className="h-14" />

      <main className="max-w-[800px] mx-auto px-4 py-6 pb-28 md:pb-10">
        <AnimatePresence mode="wait">
          {activeTab === "generator" ? (
            <motion.div
              key="generator"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <GeneratorView onLoadingChange={setIsLoading} />
            </motion.div>
          ) : activeTab === "history" ? (
            <motion.div
              key="history"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <HistoryView />
            </motion.div>
          ) : (
            <motion.div
              key="sniper"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <SniperFeed />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </>
  );
}

function BottomNav({
  activeTab,
  onTabChange,
}: {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}) {
  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "generator", label: "Generator", icon: <GeneratorIcon /> },
    { id: "history", label: "History", icon: <HistoryIcon /> },
    { id: "sniper", label: "Sniper", icon: <SniperIcon /> },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-bg/95 backdrop-blur-md border-t border-white/[0.06]">
      <div className="flex">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs font-bold transition-colors ${
              activeTab === tab.id ? "text-green" : "text-text-muted"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>
    </nav>
  );
}

function GeneratorIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <rect
        x="3"
        y="3"
        width="14"
        height="14"
        rx="2.5"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M10 7v6M7 10h6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M10 6.5V10l2.5 2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SniperIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M10 3V1M10 19v-2M3 10H1M19 10h-2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
