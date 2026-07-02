"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useUser, useClerk } from "@clerk/nextjs";
import { useLang } from "@/contexts/LangContext";
import type { Lang } from "@/lib/i18n";
import UploadZone from "./UploadZone";
import ModelPicker, { ModelType } from "./ModelPicker";
import GenerateButton from "./GenerateButton";
import ResultsPanel from "./ResultsPanel";
import LangToggle from "./LangToggle";

interface Listing {
  title: string;
  description: string;
  hashtags: string[];
}

interface Results {
  tryOnUrl: string;
  listing: Listing;
}

interface UserStatus {
  tier: "free" | "pro" | "unlimited";
  used: number;
  limit: number | null;
  resetAt: string | null;
}

interface GeneratorViewProps {
  onLoadingChange: (loading: boolean) => void;
}

export default function GeneratorView({ onLoadingChange }: GeneratorViewProps) {
  const { t } = useLang();
  const { isSignedIn, isLoaded } = useUser();
  const { openSignIn } = useClerk();

  const [images, setImages] = useState<string[]>([]);
  const [modelType, setModelType] = useState<ModelType>("model-01");
  const [customModelImage, setCustomModelImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<Results | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [listingLang, setListingLang] = useState<Lang>("de");
  const [userStatus, setUserStatus] = useState<UserStatus | null>(null);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);

  // Fetch user's generation status whenever they sign in
  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setUserStatus(null);
      return;
    }
    fetch("/api/user/status")
      .then((r) => r.json())
      .then((data) => {
        if (!data.error) setUserStatus(data as UserStatus);
      })
      .catch(() => null);
  }, [isSignedIn, isLoaded]);

  const canGenerate =
    images.length > 0 &&
    (modelType !== "custom" || customModelImage !== null);

  // Button is only disabled when signed in but content missing
  const isButtonDisabled = isLoaded && !!isSignedIn && !canGenerate;

  const handleGenerate = async () => {
    // Not signed in → open Clerk sign-in modal
    if (!isSignedIn) {
      openSignIn();
      return;
    }

    if (!canGenerate || isLoading) return;

    setIsLoading(true);
    setError(null);
    setResults(null);
    setShowUpgradePrompt(false);
    onLoadingChange(true);

    const modelImage =
      modelType === "custom" && customModelImage
        ? customModelImage
        : `preset:${modelType}`;

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ garmentImages: images, modelImage, listingLang }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.code === "LIMIT_REACHED") {
          setShowUpgradePrompt(true);
          return;
        }
        throw new Error(data.error || "Generation failed");
      }

      setResults(data);

      // Refresh counter after successful generation
      fetch("/api/user/status")
        .then((r) => r.json())
        .then((d) => { if (!d.error) setUserStatus(d); })
        .catch(() => null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error occurred");
    } finally {
      setIsLoading(false);
      onLoadingChange(false);
    }
  };

  const generationsLeft =
    userStatus?.limit != null
      ? Math.max(0, userStatus.limit - userStatus.used)
      : null;

  return (
    <div className="space-y-8">
      <div className="text-center pt-2">
        <h1 className="text-3xl md:text-4xl font-extrabold text-white leading-tight tracking-tight">
          Snap. Generate. <span className="text-green">Sell.</span>
        </h1>
        <p className="text-text-secondary text-sm mt-2">{t.hero}</p>
      </div>

      <div>
        <SectionLabel label={t.s01} />
        <UploadZone images={images} onChange={setImages} />
      </div>

      <div>
        <SectionLabel label={t.s02} />
        <ModelPicker
          selected={modelType}
          customModelImage={customModelImage}
          onChange={setModelType}
          onCustomImageChange={setCustomModelImage}
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2.5">
          <p className="text-text-muted text-[10px] font-extrabold uppercase tracking-widest">
            {t.s03}
          </p>
          <div className="flex items-center gap-1.5">
            <span className="text-text-muted text-[10px] font-extrabold uppercase tracking-wider">
              {t.listingLangLabel}:
            </span>
            <LangToggle value={listingLang} onChange={setListingLang} />
          </div>
        </div>
        <GenerateButton
          onClick={handleGenerate}
          disabled={isButtonDisabled}
          isLoading={isLoading}
        />

        {/* Generation counter */}
        {isLoaded && isSignedIn && userStatus && !showUpgradePrompt && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center justify-between mt-2.5 px-1"
          >
            <span className="text-text-muted text-xs">
              {userStatus.limit === null ? (
                <span className="text-green font-bold">∞ Unlimited generations</span>
              ) : (
                <>
                  <span
                    className={
                      generationsLeft === 0
                        ? "text-red-400 font-bold"
                        : generationsLeft! <= 1
                        ? "text-yellow-400 font-bold"
                        : "text-text-muted"
                    }
                  >
                    {generationsLeft} of {userStatus.limit} left
                  </span>
                  {" "}this month
                </>
              )}
            </span>
            {userStatus.tier === "free" && (
              <Link
                href="/pricing"
                className="text-green text-xs font-bold hover:underline"
              >
                Upgrade ↗
              </Link>
            )}
          </motion.div>
        )}

        {/* Not signed in hint */}
        {isLoaded && !isSignedIn && (
          <p className="text-text-muted text-xs text-center mt-2.5">
            Sign in to start generating — it&apos;s free
          </p>
        )}
      </div>

      {/* Upgrade prompt */}
      <AnimatePresence>
        {showUpgradePrompt && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.2 }}
            className="bg-surface border border-green/20 rounded-card p-5 text-center"
          >
            <p className="text-2xl mb-2">⚡</p>
            <p className="text-white font-extrabold text-base">
              You&apos;ve hit your monthly limit
            </p>
            <p className="text-text-secondary text-sm mt-1 mb-4">
              {userStatus?.tier === "free"
                ? "Free plan includes 3 generations/month. Upgrade for more."
                : "You've used all 100 Pro generations this month."}
            </p>
            <Link
              href="/pricing"
              className="inline-block bg-green text-bg font-extrabold text-sm px-6 py-3 rounded-pill hover:bg-green/90 transition-colors"
            >
              {userStatus?.tier === "free"
                ? "Go Pro — €9.90/month"
                : "Go Unlimited — €19.90/month"}
            </Link>
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-500/10 border border-red-500/20 rounded-card p-4 text-red-400 text-sm"
        >
          {error}
        </motion.div>
      )}

      {results && !isLoading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
        >
          <SectionLabel label={t.s04} />
          <ResultsPanel tryOnUrl={results.tryOnUrl} listing={results.listing} />
        </motion.div>
      )}
    </div>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <p className="text-text-muted text-[10px] font-extrabold uppercase tracking-widest mb-2.5">
      {label}
    </p>
  );
}
