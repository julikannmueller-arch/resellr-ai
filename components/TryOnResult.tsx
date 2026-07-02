"use client";

import { motion } from "framer-motion";
import { useLang } from "@/contexts/LangContext";

interface TryOnResultProps {
  imageUrl: string;
}

export default function TryOnResult({ imageUrl }: TryOnResultProps) {
  const { t } = useLang();

  const handleDownload = async () => {
    try {
      const res = await fetch(imageUrl);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = "resellr-tryon.jpg";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(imageUrl, "_blank");
    }
  };

  return (
    <div className="bg-surface border border-white/[0.06] rounded-card overflow-hidden h-full flex flex-col">
      <div className="relative aspect-[3/4] w-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt="AI Try-On"
          className="w-full h-full object-cover"
        />
      </div>
      <div className="p-3 mt-auto">
        <motion.button
          onClick={handleDownload}
          whileTap={{ scale: 0.97 }}
          transition={{ duration: 0.12 }}
          className="w-full py-3 px-4 rounded-pill border border-white/[0.10] text-sm font-bold text-white hover:border-white/30 transition-colors flex items-center justify-center gap-2"
        >
          <DownloadIcon />
          {t.download}
        </motion.button>
      </div>
    </div>
  );
}

function DownloadIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
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
