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

interface Listing {
  title: string;
  description: string;
}

interface Results {
  tryOnUrl: string;
  listing: Listing;
}

interface UserStatus {
  used: number;
  limit: number;
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
  const [userStatus, setUserStatus] = useState<UserStatus | null>(null);
  // Seconds left on the burst rate-limit cooldown (from a 429 Retry-After). 0 = clear.
  const [cooldown, setCooldown] = useState(0);
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
  const generationsLeft = userStatus
    ? Math.max(0, userStatus.limit - userStatus.used)
    : null;
  // Unlimited users never hit the limit — keep the button enabled regardless.
  const limitReached = !isUnlimited && generationsLeft === 0;

  // Disabled when signed in but content missing, the demo limit is used up, or
  // a burst-rate-limit cooldown is running.
  const isButtonDisabled =
    isLoaded && !!isSignedIn && (!canGenerate || limitReached || cooldown > 0);

  const handleGenerate = async () => {
    // Not signed in → open Clerk sign-in modal
    if (!isSignedIn) {
      openSignIn();
      return;
    }

    if (!canGenerate || isLoading || limitReached || cooldown > 0) return;

    setIsLoading(true);
    setError(null);
    setResults(null);
    onLoadingChange(true);

    setGameResultReady(false);

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
          // Sync the counter — the limit banner renders from userStatus
          setUserStatus({ used: data.used, limit: data.limit });
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

      setResults(data);

      // Result is set — now pre-decode the try-on image before telling the
      // game it's ready, so "Exit" reveals everything instantly
      await preloadImage(data.tryOnUrl);
      setGameResultReady(true);

      // Refresh counter after successful generation
      fetch("/api/user/status")
        .then((r) => r.json())
        .then((d) => { if (!d.error) setUserStatus(d); })
        .catch(() => null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error occurred");
      setGameOpen(false); // close the game so the error is visible
    } finally {
      setIsLoading(false);
      onLoadingChange(false);
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

        {/* Remaining generations counter */}
        {isLoaded && isSignedIn && userStatus && !isUnlimited && !limitReached && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center justify-center mt-2.5 px-1"
          >
            <span
              className={`text-xs font-bold ${
                generationsLeft! <= 1 ? "text-yellow-400" : "text-green"
              }`}
            >
              {t.genLeft
                .replace("{n}", String(generationsLeft))
                .replace("{total}", String(userStatus.limit))}
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

      {/* Demo limit reached — informational only, no payment prompt */}
      <AnimatePresence>
        {isLoaded && isSignedIn && limitReached && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.2 }}
            className="bg-surface border border-green/30 rounded-card p-5 text-center"
          >
            <p className="text-2xl mb-2">💚</p>
            <p className="text-green font-extrabold text-base">
              {t.demoLimitTitle}
            </p>
            <p className="text-text-secondary text-sm mt-1">{t.demoLimitMsg}</p>
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
