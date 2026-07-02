"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useUser, useClerk, SignInButton, UserButton } from "@clerk/nextjs";

interface PricingTier {
  id: "free" | "pro" | "unlimited";
  name: string;
  price: string;
  period: string;
  description: string;
  limit: string;
  features: string[];
  cta: string;
  highlight: boolean;
}

const TIERS: PricingTier[] = [
  {
    id: "free",
    name: "Free",
    price: "€0",
    period: "forever",
    description: "Try it out",
    limit: "3 generations / month",
    features: [
      "3 AI try-on generations/month",
      "Automated Vinted listing",
      "12 preset models",
      "Upload your own model",
    ],
    cta: "Get started free",
    highlight: false,
  },
  {
    id: "pro",
    name: "Pro",
    price: "€9.90",
    period: "/ month",
    description: "For active resellers",
    limit: "100 generations / month",
    features: [
      "100 AI try-on generations/month",
      "Automated Vinted listing",
      "12 preset models",
      "Upload your own model",
      "HD quality output",
      "Early access to Sniper Feed",
    ],
    cta: "Go Pro",
    highlight: true,
  },
  {
    id: "unlimited",
    name: "Unlimited",
    price: "€19.90",
    period: "/ month",
    description: "For power resellers",
    limit: "Unlimited generations",
    features: [
      "Unlimited AI try-on generations",
      "Automated Vinted listing",
      "12 preset models",
      "Upload your own model",
      "HD quality output",
      "Full Sniper Feed access",
      "Priority generation queue",
    ],
    cta: "Go Unlimited",
    highlight: false,
  },
];

export default function PricingPage() {
  const searchParams = useSearchParams();
  const success = searchParams.get("success") === "true";
  const { isSignedIn } = useUser();
  const { openSignIn } = useClerk();
  const [loadingTier, setLoadingTier] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(success);

  useEffect(() => {
    if (success) {
      const t = setTimeout(() => setShowSuccess(false), 8000);
      return () => clearTimeout(t);
    }
  }, [success]);

  const handleUpgrade = async (tier: "pro" | "unlimited") => {
    if (!isSignedIn) {
      openSignIn();
      return;
    }

    setLoadingTier(tier);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      setLoadingTier(null);
    }
  };

  return (
    <div className="min-h-screen bg-bg">
      {/* Minimal header */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/[0.06] bg-bg/90 backdrop-blur-md">
        <div className="max-w-[900px] mx-auto px-4 h-14 flex items-center justify-between">
          <Link
            href="/"
            className="font-extrabold text-base tracking-tight text-white hover:text-white/80 transition-colors"
          >
            Resellr AI
          </Link>
          <Link
            href="/"
            className="text-xs font-bold text-text-muted hover:text-text-secondary transition-colors flex items-center gap-1"
          >
            ← Back to Generator
          </Link>
        </div>
      </header>

      <div className="h-14" />

      <main className="max-w-[900px] mx-auto px-4 py-12 pb-20">
        {/* Success banner */}
        <AnimatePresence>
          {showSuccess && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mb-8 bg-green/10 border border-green/30 rounded-card p-4 flex items-center gap-3"
            >
              <span className="text-2xl">🎉</span>
              <div>
                <p className="text-green font-extrabold text-sm">
                  Subscription activated!
                </p>
                <p className="text-text-secondary text-xs mt-0.5">
                  You&apos;re all set — go generate some listings.
                </p>
              </div>
              <Link
                href="/"
                className="ml-auto text-green text-xs font-bold hover:underline"
              >
                Open Generator →
              </Link>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Hero */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight">
            Plans &amp; <span className="text-green">Pricing</span>
          </h1>
          <p className="text-text-secondary text-base mt-3">
            Scale your Vinted reselling. Cancel any time.
          </p>
        </div>

        {/* Tier cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {TIERS.map((tier, i) => (
            <motion.div
              key={tier.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.08 }}
              className={`relative bg-surface rounded-card p-6 flex flex-col border transition-all ${
                tier.highlight
                  ? "border-green shadow-glow-green"
                  : "border-white/[0.08]"
              }`}
            >
              {tier.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-green text-bg text-[10px] font-extrabold px-3 py-1 rounded-full">
                    MOST POPULAR
                  </span>
                </div>
              )}

              {/* Header */}
              <div className="mb-6">
                <p className="text-text-muted text-xs font-extrabold uppercase tracking-widest mb-1">
                  {tier.name}
                </p>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-4xl font-extrabold text-white">
                    {tier.price}
                  </span>
                  <span className="text-text-muted text-sm">{tier.period}</span>
                </div>
                <p className="text-text-muted text-sm">{tier.description}</p>
              </div>

              {/* Limit badge */}
              <div className="mb-5 bg-white/[0.04] rounded-input px-3 py-2">
                <p
                  className={`text-sm font-extrabold ${
                    tier.highlight ? "text-green" : "text-white"
                  }`}
                >
                  {tier.limit}
                </p>
              </div>

              {/* Features */}
              <ul className="space-y-2.5 mb-8 flex-1">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm">
                    <CheckIcon highlight={tier.highlight} />
                    <span className="text-text-secondary">{f}</span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              {tier.id === "free" ? (
                isSignedIn ? (
                  <Link
                    href="/"
                    className="block w-full text-center py-3 rounded-pill border border-white/[0.12] text-sm font-extrabold text-text-secondary hover:border-white/30 hover:text-white transition-all"
                  >
                    Go to Generator
                  </Link>
                ) : (
                  <SignInButton mode="modal">
                    <button className="w-full py-3 rounded-pill border border-white/[0.12] text-sm font-extrabold text-text-secondary hover:border-white/30 hover:text-white transition-all">
                      {tier.cta}
                    </button>
                  </SignInButton>
                )
              ) : (
                <button
                  onClick={() => handleUpgrade(tier.id as "pro" | "unlimited")}
                  disabled={loadingTier === tier.id}
                  className={`w-full py-3 rounded-pill text-sm font-extrabold transition-all disabled:opacity-60 disabled:cursor-wait ${
                    tier.highlight
                      ? "bg-green text-bg hover:bg-green/90"
                      : "border border-white/[0.20] text-white hover:border-white/40"
                  }`}
                >
                  {loadingTier === tier.id ? "Redirecting…" : tier.cta}
                </button>
              )}
            </motion.div>
          ))}
        </div>

        {/* Footer note */}
        <p className="text-center text-text-muted text-xs mt-10">
          All prices include VAT where applicable. Subscriptions are billed monthly and can be cancelled any time.
        </p>
      </main>
    </div>
  );
}

function CheckIcon({ highlight }: { highlight: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      className="mt-0.5 flex-shrink-0"
    >
      <circle cx="7" cy="7" r="7" fill={highlight ? "#1ED760" : "rgba(255,255,255,0.08)"} />
      <path
        d="M4 7l2 2 4-3.5"
        stroke={highlight ? "#0A0A0A" : "rgba(255,255,255,0.4)"}
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
