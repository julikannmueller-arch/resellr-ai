"use client";

import { motion } from "framer-motion";
import { useLang } from "@/contexts/LangContext";
import TryOnResult from "./TryOnResult";
import ListingResult from "./ListingResult";

interface Listing {
  title: string;
  description: string;
}

interface ResultsPanelProps {
  tryOnUrl: string;
  /** Null until the user opts to generate a description. */
  listing: Listing | null;
  /** False when the generation couldn't be saved (no id → no listing possible). */
  canGenerateListing: boolean;
  listingLoading: boolean;
  onGenerateListing: () => void;
}

const container = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.08 },
  },
};

const item = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" as const } },
};

export default function ResultsPanel({
  tryOnUrl,
  listing,
  canGenerateListing,
  listingLoading,
  onGenerateListing,
}: ResultsPanelProps) {
  const { t } = useLang();

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start"
    >
      <motion.div variants={item}>
        <TryOnResult imageUrl={tryOnUrl} />
      </motion.div>
      <motion.div variants={item}>
        {listing ? (
          // Copy buttons live inside ListingResult → they only exist once a
          // description has actually been generated.
          <ListingResult listing={listing} />
        ) : (
          <div className="bg-surface border border-white/[0.06] rounded-card p-6 h-full flex flex-col items-center justify-center gap-3 text-center">
            {canGenerateListing ? (
              <>
                <p className="text-text-secondary text-sm">{t.listingPrompt}</p>
                <button
                  onClick={onGenerateListing}
                  disabled={listingLoading}
                  className="flex items-center gap-2 bg-green text-bg font-extrabold text-sm px-6 py-3 rounded-pill hover:bg-green/90 transition-colors disabled:opacity-60 disabled:cursor-default"
                >
                  {listingLoading ? (
                    <>
                      <Spinner />
                      {t.listingGenerating}
                    </>
                  ) : (
                    t.listingGenerateBtn
                  )}
                </button>
              </>
            ) : (
              <p className="text-text-muted text-xs">{t.listingUnavailable}</p>
            )}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

function Spinner() {
  return (
    <svg
      className="animate-spin"
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path
        d="M21 12a9 9 0 00-9-9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
