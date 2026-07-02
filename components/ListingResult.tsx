"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLang } from "@/contexts/LangContext";

interface Listing {
  title: string;
  description: string;
  hashtags: string[];
}

interface ListingResultProps {
  listing: Listing;
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  const { t } = useLang();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <motion.button
      onClick={handleCopy}
      whileTap={{ scale: 0.95 }}
      transition={{ duration: 0.12 }}
      className="flex items-center gap-1.5 text-text-muted hover:text-white transition-colors text-xs font-bold min-w-[80px] justify-end"
    >
      <AnimatePresence mode="wait">
        {copied ? (
          <motion.span
            key="copied"
            initial={{ opacity: 0, y: -2 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 2 }}
            transition={{ duration: 0.15 }}
            className="text-green"
          >
            {t.copied}
          </motion.span>
        ) : (
          <motion.span
            key="idle"
            initial={{ opacity: 0, y: 2 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -2 }}
            transition={{ duration: 0.15 }}
            className="flex items-center gap-1"
          >
            <CopyIcon />
            {label ?? t.copy}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

export default function ListingResult({ listing }: ListingResultProps) {
  const { t } = useLang();
  const hashtagString = listing.hashtags
    .map((h) => (h.startsWith("#") ? h : `#${h}`))
    .join(" ");

  return (
    <div className="bg-surface border border-white/[0.06] rounded-card p-4 flex flex-col gap-4 h-full">
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-text-muted text-[10px] font-extrabold uppercase tracking-widest">
            {t.listingTitle}
          </span>
          <CopyButton text={listing.title} />
        </div>
        <p className="text-white text-sm font-bold leading-snug">{listing.title}</p>
      </div>

      <div className="h-px bg-white/[0.06]" />

      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-text-muted text-[10px] font-extrabold uppercase tracking-widest">
            {t.listingDesc}
          </span>
          <CopyButton text={listing.description} />
        </div>
        <p className="text-text-secondary text-xs leading-relaxed whitespace-pre-line">
          {listing.description}
        </p>
      </div>

      <div className="h-px bg-white/[0.06]" />

      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-text-muted text-[10px] font-extrabold uppercase tracking-widest">
            {t.listingHashtags}
          </span>
          <CopyButton text={hashtagString} label={t.copyAll} />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {listing.hashtags.map((tag, i) => (
            <span
              key={i}
              className="px-2 py-0.5 bg-white/[0.05] rounded-pill text-text-secondary text-[10px] border border-white/[0.06]"
            >
              {tag.startsWith("#") ? tag : `#${tag}`}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function CopyIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
      <rect
        x="3.5"
        y="3.5"
        width="6.5"
        height="6.5"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.1"
      />
      <path
        d="M1 7V2a1 1 0 011-1h5"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
    </svg>
  );
}
