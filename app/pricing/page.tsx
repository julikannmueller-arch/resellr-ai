"use client";

import { useState } from "react";
import Link from "next/link";
import { useUser, useClerk } from "@clerk/nextjs";
import { useLang } from "@/contexts/LangContext";
import { PLANS, type Plan } from "@/lib/pricing";

export default function PricingPage() {
  const { t } = useLang();
  const { isSignedIn } = useUser();
  const { openSignIn } = useClerk();
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const subs = PLANS.filter((p) => p.kind === "subscription");
  const packs = PLANS.filter((p) => p.kind === "pack");

  const buy = async (key: string) => {
    if (!isSignedIn) {
      openSignIn();
      return;
    }
    setError(null);
    setLoadingKey(key);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url; // → Stripe Checkout
        return;
      }
      throw new Error(data.error || "Checkout failed");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed");
      setLoadingKey(null);
    }
  };

  return (
    <main className="max-w-[880px] mx-auto px-4 py-8 pb-20">
      <Link
        href="/"
        className="text-text-muted hover:text-white text-sm font-bold transition-colors"
      >
        {t.pricingBack}
      </Link>

      <div className="text-center mt-6 mb-8">
        <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
          {t.pricingTitle}
        </h1>
        <p className="text-text-secondary text-sm mt-2">{t.pricingSubtitle}</p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-card p-3 text-red-400 text-sm text-center mb-6">
          {error}
        </div>
      )}

      {/* Subscriptions */}
      <SectionLabel label={t.pricingSubs} />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-9">
        {subs.map((p) => (
          <PlanCard
            key={p.key}
            plan={p}
            highlight={p.key === "sub_pro"}
            perMonth
            cta={t.pricingSubscribe}
            creditsLabel={t.creditsPerMonth.replace("{n}", String(p.credits))}
            loading={loadingKey === p.key}
            disabled={loadingKey !== null}
            onClick={() => buy(p.key)}
          />
        ))}
      </div>

      {/* One-time packs */}
      <SectionLabel label={t.pricingPacks} />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {packs.map((p) => (
          <PlanCard
            key={p.key}
            plan={p}
            cta={t.pricingBuy}
            creditsLabel={t.creditsOnce.replace("{n}", String(p.credits))}
            loading={loadingKey === p.key}
            disabled={loadingKey !== null}
            onClick={() => buy(p.key)}
          />
        ))}
      </div>

      {!isSignedIn && (
        <p className="text-text-muted text-xs text-center mt-8">{t.pricingSignIn}</p>
      )}
    </main>
  );
}

function PlanCard({
  plan,
  cta,
  creditsLabel,
  perMonth = false,
  highlight = false,
  loading,
  disabled,
  onClick,
}: {
  plan: Plan;
  cta: string;
  creditsLabel: string;
  perMonth?: boolean;
  highlight?: boolean;
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const { t } = useLang();
  return (
    <div
      className={`rounded-card p-5 flex flex-col ${
        highlight
          ? "bg-green/[0.07] border-2 border-green shadow-glow-green"
          : "bg-surface border border-white/[0.08]"
      }`}
    >
      <p className="text-white font-extrabold text-lg">{plan.label}</p>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-white font-extrabold text-2xl tabular-nums">
          €{plan.priceEur.toFixed(2)}
        </span>
        {perMonth && (
          <span className="text-text-muted text-xs font-bold">/ Mon</span>
        )}
      </div>
      <p className="text-green text-sm font-bold mt-2">{creditsLabel}</p>

      <button
        onClick={onClick}
        disabled={disabled}
        className={`mt-5 w-full rounded-pill font-extrabold text-sm py-2.5 transition-colors disabled:opacity-60 disabled:cursor-default ${
          highlight
            ? "bg-green text-bg hover:bg-green/90"
            : "bg-white/[0.08] text-white hover:bg-white/[0.14]"
        }`}
      >
        {loading ? `${t.generateLoading}` : cta}
      </button>
    </div>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <p className="text-text-muted text-[10px] font-extrabold uppercase tracking-widest mb-3">
      {label}
    </p>
  );
}
