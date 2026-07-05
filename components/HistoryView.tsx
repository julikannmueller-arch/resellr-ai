"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useUser, useClerk } from "@clerk/nextjs";
import { useLang } from "@/contexts/LangContext";

interface GenerationEntry {
  id: string;
  image_url: string | null;
  listing_title: string | null;
  listing_description: string | null;
  model_used: string | null;
  language: string;
  created_at: string;
}

export default function HistoryView() {
  const { t, uiLang } = useLang();
  const { isSignedIn, isLoaded } = useUser();
  const { openSignIn } = useClerk();
  const [entries, setEntries] = useState<GenerationEntry[] | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    fetch("/api/user/generations")
      .then((r) => r.json())
      .then((d) => setEntries(d.generations ?? []))
      .catch(() => setEntries([]));
  }, [isLoaded, isSignedIn]);

  // Same direct-download behavior as the Generate page: the same-origin
  // proxy responds with Content-Disposition: attachment → no new tab
  const handleImageDownload = (imageUrl: string) => {
    const a = document.createElement("a");
    a.href = `/api/download?url=${encodeURIComponent(imageUrl)}`;
    a.download = "resellr-tryon.jpg";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Copies title + description as one block (hashtags live inside the description)
  const handleCopy = async (entry: GenerationEntry) => {
    const text = [entry.listing_title, entry.listing_description]
      .filter(Boolean)
      .join("\n\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(entry.id);
      setTimeout(() => setCopiedId((id) => (id === entry.id ? null : id)), 1500);
    } catch {
      /* clipboard unavailable (non-secure context) — silently ignore */
    }
  };

  if (!isLoaded) return null;

  if (!isSignedIn) {
    return (
      <div className="bg-surface border border-white/[0.06] rounded-card p-10 text-center">
        <p className="text-text-secondary text-sm mb-4">{t.historySignIn}</p>
        <button
          onClick={() => openSignIn()}
          className="bg-green text-bg font-extrabold text-sm px-6 py-3 rounded-pill hover:bg-green/90 transition-colors"
        >
          Sign in
        </button>
      </div>
    );
  }

  // Loading skeleton
  if (entries === null) {
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="bg-surface border border-white/[0.06] rounded-card h-40 animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="bg-surface border border-white/[0.06] rounded-card p-10 text-center">
        <p className="text-3xl mb-3">👕</p>
        <p className="text-text-secondary text-sm">{t.historyEmpty}</p>
      </div>
    );
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(uiLang === "de" ? "de-DE" : "en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

  return (
    <div>
      <h2 className="text-white font-extrabold text-xl tracking-tight mb-4">
        {t.historyTitle}
      </h2>
      <div className="space-y-3">
        {entries.map((g, i) => {
          const expanded = expandedId === g.id;
          const copied = copiedId === g.id;
          return (
            <motion.div
              key={g.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: Math.min(i * 0.05, 0.3) }}
              className="bg-surface border border-white/[0.06] rounded-card overflow-hidden flex hover:border-white/[0.14] transition-colors"
            >
              {/* Try-on thumbnail — click to download */}
              <button
                onClick={() => g.image_url && handleImageDownload(g.image_url)}
                disabled={!g.image_url}
                title={t.download}
                className="group relative flex-shrink-0 w-24 md:w-28 bg-white/[0.03] disabled:cursor-default"
                style={{ aspectRatio: "9/16" }}
              >
                {g.image_url && (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={g.image_url}
                      alt={g.listing_title ?? "Try-On"}
                      className="absolute inset-0 w-full h-full object-cover"
                      loading="lazy"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                    {/* Download hint on hover */}
                    <span className="absolute inset-0 flex items-center justify-center bg-bg/0 group-hover:bg-bg/50 transition-colors">
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-green text-bg rounded-full p-2">
                        <DownloadIcon />
                      </span>
                    </span>
                  </>
                )}
              </button>

              {/* Listing details — click to expand */}
              <div
                onClick={() => setExpandedId(expanded ? null : g.id)}
                className="flex-1 min-w-0 p-4 flex flex-col cursor-pointer"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-white text-sm font-bold leading-snug line-clamp-1">
                    {g.listing_title ?? "—"}
                  </p>

                  {/* Copy full listing text — only when a description exists */}
                  {g.listing_description && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopy(g);
                      }}
                      title={t.copy}
                      className="flex-shrink-0 text-text-muted hover:text-white transition-colors p-1 -m-1"
                    >
                      <AnimatePresence mode="wait">
                        {copied ? (
                          <motion.span
                            key="check"
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            transition={{ duration: 0.15 }}
                            className="flex items-center gap-1 text-green text-[10px] font-bold"
                          >
                            <CheckIcon />
                            {t.copied}
                          </motion.span>
                        ) : (
                          <motion.span
                            key="copy"
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            transition={{ duration: 0.15 }}
                            className="block"
                          >
                            <CopyIcon />
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </button>
                  )}
                </div>

                {g.listing_description ? (
                  <p
                    className={`text-text-secondary text-xs leading-relaxed mt-1.5 whitespace-pre-line ${
                      expanded ? "" : "line-clamp-4"
                    }`}
                  >
                    {g.listing_description}
                  </p>
                ) : (
                  <p className="text-text-muted text-xs italic mt-1.5">
                    {t.noDescription}
                  </p>
                )}

                <div className="mt-auto pt-2 flex items-center gap-2">
                  <span className="text-text-muted text-[10px] font-bold">
                    {formatDate(g.created_at)}
                  </span>
                  <span className="text-text-muted text-[10px]">·</span>
                  <span className="text-text-muted text-[10px] uppercase font-bold">
                    {g.language}
                  </span>
                  <span className="ml-auto text-green text-[10px] font-bold">
                    {expanded ? "−" : "+"}
                  </span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect
        x="4.5"
        y="4.5"
        width="8"
        height="8"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <path
        d="M1.5 9V2.5A1 1 0 012.5 1.5H9"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path
        d="M2.5 7.5l3 3 6-6.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 15 15" fill="none">
      <path
        d="M7.5 2v8M4.5 7l3 3 3-3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M2 11.5V13a.5.5 0 00.5.5h10a.5.5 0 00.5-.5v-1.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
