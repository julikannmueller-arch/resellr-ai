"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useUser, useClerk } from "@clerk/nextjs";
import { useLang } from "@/contexts/LangContext";
import type { Lang } from "@/lib/i18n";
import UploadZone from "./UploadZone";
import ModelPicker, { ModelType } from "./ModelPicker";
import GenerateButton from "./GenerateButton";
import ResultsPanel from "./ResultsPanel";
import LangToggle from "./LangToggle";
import StreetrunnerGame from "./StreetrunnerGame";
import { creditCost, MODEL_LABELS, type TryOnModel } from "@/lib/pricing";

interface Listing {
  title: string;
  description: string;
}

interface Results {
  tryOnUrl: string;
  /** DB row id — needed to attach an optional listing later (null if save failed). */
  generationId: string | null;
  /** The garment photo used, kept so the on-demand listing call can reuse it. */
  garmentImage: string;
  /** Null until the user generates a description. */
  listing: Listing | null;
}

interface UserStatus {
  credits: number;
  unlimited?: boolean;
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
  // Try-on model + 4K flag drive the credit price (see lib/pricing.ts).
  const [model, setModel] = useState<TryOnModel>("nb2");
  const [is4k, setIs4k] = useState(false);
  const [userStatus, setUserStatus] = useState<UserStatus | null>(null);
  // Seconds left on the burst rate-limit cooldown (from a 429 Retry-After). 0 = clear.
  const [cooldown, setCooldown] = useState(0);
  // Spinner state for the optional on-demand listing generation.
  const [listingLoading, setListingLoading] = useState(false);
  // Game is opt-in: a prompt shows while generating; the game opens on "Play"
  const [gameOpen, setGameOpen] = useState(false);
  const [gameResultReady, setGameResultReady] = useState(false);

  // Lock body scroll while the game takes over the viewport
  useEffect(() => {
    document.body.style.overflow = gameOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [gameOpen]);

  // Rate-limit cooldown ticker: counts the 429 Retry-After down to 0, then the
  // button re-enables automatically (isButtonDisabled reads cooldown).
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  // Pre-decode the try-on image so "Exit" reveals the result with zero delay
  const preloadImage = (url: string) =>
    new Promise<void>((resolve) => {
      const img = new window.Image();
      img.onload = () => resolve();
      img.onerror = () => resolve();
      img.src = url;
      setTimeout(resolve, 8000); // safety net — never block the overlay forever
    });

  const handleExitGame = () => {
    setGameOpen(false);
    setGameResultReady(false);
  };

  // X button: if the result is already there, closing = exiting to the result;
  // otherwise back to the prompt (which stays visible while still generating)
  const handleCloseGame = () => {
    if (gameResultReady) {
      handleExitGame();
    } else {
      setGameOpen(false);
    }
  };

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

  const isUnlimited = userStatus?.unlimited === true;
  const credits = userStatus?.credits ?? null;
  const cost = creditCost({ model, is4k });
  // Unlimited users are exempt; everyone else needs enough credits for the pick.
  const notEnoughCredits =
    !isUnlimited && credits !== null && credits < cost;

  // Disabled when signed in but content missing, credits too low, or a
  // burst-rate-limit cooldown is running.
  const isButtonDisabled =
    isLoaded && !!isSignedIn && (!canGenerate || notEnoughCredits || cooldown > 0);

  const handleGenerate = async () => {
    // Not signed in → open Clerk sign-in modal
    if (!isSignedIn) {
      openSignIn();
      return;
    }

    if (!canGenerate || isLoading || notEnoughCredits || cooldown > 0) return;

    setIsLoading(true);
    setError(null);
    setResults(null);
    onLoadingChange(true);

    setGameResultReady(false);
    // Pop the minigame open immediately — it runs through the whole wait.
    setGameOpen(true);

    const modelImage =
      modelType === "custom" && customModelImage
        ? customModelImage
        : `preset:${modelType}`;

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ garmentImages: images, modelImage, listingLang, model, is4k }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.code === "INSUFFICIENT_CREDITS") {
          // Sync the balance the server reported, then surface the message
          if (typeof data.credits === "number") {
            setUserStatus((s) => (s ? { ...s, credits: data.credits } : s));
          }
          setError(data.error || "Not enough credits");
          setGameOpen(false);
          return;
        }
        if (response.status === 429 || data.code === "RATE_LIMITED") {
          // Burst limit hit — start the cooldown from the Retry-After header
          // (fall back to the body value, then a sane default).
          const header = Number(response.headers.get("Retry-After"));
          const secs =
            Number.isFinite(header) && header > 0
              ? header
              : typeof data.retryAfter === "number"
              ? data.retryAfter
              : 30;
          setCooldown(secs);
          setGameOpen(false);
          return;
        }
        throw new Error(data.error || "Generation failed");
      }

      // Image-only result — the listing is generated later on demand.
      setResults({
        tryOnUrl: data.tryOnUrl,
        generationId: data.generationId ?? null,
        garmentImage: images[0],
        listing: null,
      });

      // Server returns the post-charge balance — apply it immediately.
      if (typeof data.credits === "number") {
        setUserStatus((s) =>
          s
            ? { ...s, credits: data.credits }
            : { credits: data.credits, unlimited: data.unlimited === true }
        );
      }

      // Result is set — now pre-decode the try-on image before telling the
      // game it's ready, so "Exit" reveals everything instantly
      await preloadImage(data.tryOnUrl);
      setGameResultReady(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error occurred");
      setGameOpen(false); // close the game so the error is visible
    } finally {
      setIsLoading(false);
      onLoadingChange(false);
    }
  };

  // Optional, on-demand: generate the Vinted listing text for the current result.
  // No credits are charged — the image already paid; this only spends a GPT call.
  const handleGenerateListing = async () => {
    if (!results || !results.generationId || listingLoading) return;

    setListingLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/generate/listing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          generationId: results.generationId,
          garmentImage: results.garmentImage,
          listingLang,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Listing generation failed");
      }
      setResults((r) => (r ? { ...r, listing: data.listing } : r));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error occurred");
    } finally {
      setListingLoading(false);
    }
  };

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

        {/* Model + quality selection → drives the credit price */}
        <div className="space-y-1.5 mb-3">
          <div className="flex gap-1.5">
            {(["pro", "nb2"] as TryOnModel[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setModel(m)}
                className={`flex-1 rounded-input px-3 py-2.5 text-sm font-bold border transition-colors ${
                  model === m
                    ? "bg-green/10 border-green text-green"
                    : "bg-surface border-white/[0.08] text-text-secondary hover:border-white/20"
                }`}
              >
                {MODEL_LABELS[m]}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5">
            {([false, true] as const).map((v) => (
              <button
                key={String(v)}
                type="button"
                onClick={() => setIs4k(v)}
                className={`flex-1 rounded-input px-3 py-2 text-sm font-bold border transition-colors ${
                  is4k === v
                    ? "bg-green/10 border-green text-green"
                    : "bg-surface border-white/[0.08] text-text-secondary hover:border-white/20"
                }`}
              >
                {v ? t.res4k : t.resStandard}
              </button>
            ))}
          </div>
          {/* Live price line, e.g. "Nano Banana 2 · 4K — 10 Credits" */}
          <div className="flex items-center justify-center pt-0.5">
            <span className="text-xs font-bold text-text-secondary">
              {MODEL_LABELS[model]}
              {is4k ? " · 4K" : ""} —{" "}
              <span className="text-green">
                {cost} {t.creditsUnit}
              </span>
            </span>
          </div>
        </div>

        <GenerateButton
          onClick={handleGenerate}
          disabled={isButtonDisabled}
          isLoading={isLoading}
        />

        {/* Burst rate-limit cooldown — button re-enables when this hits 0 */}
        {isLoaded && isSignedIn && cooldown > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center justify-center mt-2.5 px-1"
          >
            <span className="text-xs font-bold text-yellow-400">
              {t.rateLimited.replace("{n}", String(cooldown))}
            </span>
          </motion.div>
        )}

        {/* Unlimited badge — shown for owner/comp accounts instead of a counter */}
        {isLoaded && isSignedIn && isUnlimited && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center justify-center mt-2.5 px-1"
          >
            <span className="text-xs font-bold text-green">{t.genUnlimited}</span>
          </motion.div>
        )}

        {/* Available credits */}
        {isLoaded && isSignedIn && !isUnlimited && credits !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center justify-center mt-2.5 px-1"
          >
            <span
              className={`text-xs font-bold ${
                notEnoughCredits
                  ? "text-red-400"
                  : credits < cost * 2
                  ? "text-yellow-400"
                  : "text-green"
              }`}
            >
              {t.creditsAvailable.replace("{n}", String(credits))}
            </span>
          </motion.div>
        )}

        {/* Not signed in hint */}
        {isLoaded && !isSignedIn && (
          <p className="text-text-muted text-xs text-center mt-2.5">
            Sign in to start generating — it&apos;s free
          </p>
        )}
      </div>

      {/* Play prompt while generating — reappears whenever the game is closed */}
      <AnimatePresence>
        {isLoading && !gameOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="bg-surface border border-green/30 rounded-card p-4 flex items-center justify-between gap-3"
          >
            <p className="text-text-secondary text-sm">{t.gamePrompt}</p>
            <button
              onClick={() => setGameOpen(true)}
              className="flex-shrink-0 bg-green text-bg font-extrabold text-sm px-6 py-2.5 rounded-pill hover:bg-green/90 transition-colors"
            >
              {t.gamePlay} ▸
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Streetrunner: fullscreen takeover, opened via the prompt */}
      <AnimatePresence>
        {gameOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[100] bg-bg/95 backdrop-blur-sm flex items-center justify-center p-4 md:p-8"
          >
            <div className="w-full max-w-[820px]">
              <StreetrunnerGame
                resultReady={gameResultReady}
                onExit={handleExitGame}
                onClose={handleCloseGame}
              />
            </div>
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

      {results && !isLoading && !gameOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
        >
          <SectionLabel label={t.s04} />
          <ResultsPanel
            tryOnUrl={results.tryOnUrl}
            listing={results.listing}
            canGenerateListing={results.generationId !== null}
            listingLoading={listingLoading}
            onGenerateListing={handleGenerateListing}
          />
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
