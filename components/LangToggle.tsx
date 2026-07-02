"use client";

import { motion } from "framer-motion";
import type { Lang } from "@/lib/i18n";

interface LangToggleProps {
  value: Lang;
  onChange: (lang: Lang) => void;
}

export default function LangToggle({ value, onChange }: LangToggleProps) {
  return (
    <div className="flex items-center bg-surface rounded-pill p-0.5 border border-white/[0.06]">
      {(["en", "de"] as Lang[]).map((lang) => (
        <motion.button
          key={lang}
          onClick={() => onChange(lang)}
          whileTap={{ scale: 0.95 }}
          transition={{ duration: 0.12 }}
          className={`px-2.5 py-1 rounded-pill text-[10px] font-extrabold uppercase tracking-wider transition-colors ${
            value === lang
              ? "bg-white/[0.08] text-white"
              : "text-text-muted hover:text-text-secondary"
          }`}
        >
          {lang.toUpperCase()}
        </motion.button>
      ))}
    </div>
  );
}
