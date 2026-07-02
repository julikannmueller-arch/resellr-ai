"use client";

import { motion, AnimatePresence } from "framer-motion";

interface ProgressBarProps {
  isLoading: boolean;
}

export default function ProgressBar({ isLoading }: ProgressBarProps) {
  return (
    <div className="fixed top-14 left-0 right-0 z-50 h-0.5 bg-transparent">
      <AnimatePresence>
        {isLoading && (
          <motion.div
            className="h-full bg-green"
            initial={{ width: "0%", opacity: 1 }}
            animate={{ width: "85%" }}
            exit={{ width: "100%", opacity: 0 }}
            transition={{
              width: { duration: 15, ease: [0.1, 0.4, 0.8, 1] },
              opacity: { duration: 0.3 },
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
