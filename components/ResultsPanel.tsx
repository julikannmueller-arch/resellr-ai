"use client";

import { motion } from "framer-motion";
import TryOnResult from "./TryOnResult";
import ListingResult from "./ListingResult";

interface Listing {
  title: string;
  description: string;
}

interface ResultsPanelProps {
  tryOnUrl: string;
  listing: Listing;
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

export default function ResultsPanel({ tryOnUrl, listing }: ResultsPanelProps) {
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
        <ListingResult listing={listing} />
      </motion.div>
    </motion.div>
  );
}
