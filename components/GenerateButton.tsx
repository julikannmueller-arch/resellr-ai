"use client";

import { motion } from "framer-motion";
import { useLang } from "@/contexts/LangContext";

interface GenerateButtonProps {
  onClick: () => void;
  disabled: boolean;
  isLoading: boolean;
}

export default function GenerateButton({
  onClick,
  disabled,
  isLoading,
}: GenerateButtonProps) {
  const { t } = useLang();
  const isDisabled = disabled || isLoading;

  return (
    <motion.button
      onClick={onClick}
      disabled={isDisabled}
      whileTap={!isDisabled ? { scale: 0.97 } : {}}
      transition={{ duration: 0.12 }}
      className={`w-full py-4 px-8 rounded-pill font-extrabold text-base transition-all duration-150 ${
        isLoading
          ? "bg-green/60 text-black/60 cursor-not-allowed"
          : disabled
          ? "bg-surface text-text-muted cursor-not-allowed border border-white/[0.06]"
          : "bg-green text-black hover:shadow-glow-green cursor-pointer"
      }`}
    >
      {isLoading ? t.generateLoading : t.generateBtn}
    </motion.button>
  );
}
