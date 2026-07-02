"use client";

import { motion } from "framer-motion";
import { useLang } from "@/contexts/LangContext";

const MOCK_DEALS = [
  {
    id: 1,
    brand: "True Religion",
    item: "Flare Jeans Low Rise Y2K",
    listed: 22,
    market: 75,
  },
  {
    id: 2,
    brand: "Adidas",
    item: "Real Madrid Track Jacket",
    listed: 18,
    market: 58,
  },
  {
    id: 3,
    brand: "Ralph Lauren",
    item: "Polo Shirt Vintage 90s",
    listed: 12,
    market: 38,
  },
  {
    id: 4,
    brand: "Miss Sixty",
    item: "Y2K Low Rise Flare Denim",
    listed: 25,
    market: 72,
  },
  {
    id: 5,
    brand: "Levi's",
    item: "501 Vintage Wash Straight",
    listed: 20,
    market: 52,
  },
  {
    id: 6,
    brand: "Carhartt WIP",
    item: "Detroit Jacket Blanket Lined",
    listed: 38,
    market: 90,
  },
];

function discountPct(listed: number, market: number) {
  return Math.round(((market - listed) / market) * 100);
}

const cardVariants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0 },
};

export default function SniperFeed() {
  const { t } = useLang();

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="bg-surface border border-green/20 rounded-card p-6 text-center"
      >
        <div className="flex items-center justify-center gap-2 mb-3">
          <span className="text-xl">🔔</span>
          <h2 className="text-white font-extrabold text-xl">Sniper Feed</h2>
          <span className="px-2.5 py-0.5 bg-green text-black text-xs font-extrabold rounded-pill">
            Coming Soon
          </span>
        </div>
        <p className="text-text-secondary text-sm leading-relaxed max-w-sm mx-auto">
          {t.sniperDesc}
        </p>
        <div className="flex items-center justify-center gap-3 mt-5">
          <button
            disabled
            className="px-5 py-2.5 rounded-pill border border-white/[0.10] text-text-muted text-sm font-bold cursor-not-allowed"
          >
            {t.sniperWaitlist}
          </button>
        </div>
        <p className="text-text-muted text-xs mt-3">{t.sniperPush}</p>
      </motion.div>

      <div>
        <p className="text-text-muted text-[10px] font-extrabold uppercase tracking-widest mb-3">
          {t.sniperPreview}
        </p>
        <motion.div
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: 0.05 } },
          }}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-2 gap-3"
        >
          {MOCK_DEALS.map((deal) => (
            <motion.div
              key={deal.id}
              variants={cardVariants}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="bg-surface border border-white/[0.06] rounded-card p-3 flex gap-3 select-none"
            >
              <div className="w-16 h-16 rounded-input bg-white/[0.04] border border-white/[0.06] flex-shrink-0 flex items-center justify-center text-xl">
                👕
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-text-muted text-[10px] font-bold uppercase tracking-wide">
                  {deal.brand}
                </p>
                <p className="text-white text-sm font-bold truncate mt-0.5">
                  {deal.item}
                </p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-white text-sm font-extrabold">
                    {deal.listed} €
                  </span>
                  <span className="text-text-muted text-xs line-through">
                    ~{deal.market} €
                  </span>
                </div>
              </div>

              <div className="flex-shrink-0 flex flex-col items-end justify-between">
                <span className="px-2 py-0.5 bg-green text-black text-xs font-extrabold rounded-pill whitespace-nowrap">
                  −{discountPct(deal.listed, deal.market)}%
                </span>
                <span className="text-text-muted text-[10px] font-bold cursor-not-allowed">
                  {t.sniperDeal}
                </span>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
