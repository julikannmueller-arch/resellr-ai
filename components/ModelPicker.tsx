"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLang } from "@/contexts/LangContext";

export type ModelType = string; // "model-01" … "model-12" | "custom"

interface ModelPickerProps {
  selected: ModelType;
  customModelImage: string | null;
  onChange: (type: ModelType) => void;
  onCustomImageChange: (image: string) => void;
}

const PRESETS = Array.from({ length: 12 }, (_, i) => {
  const n = String(i + 1).padStart(2, "0");
  return { id: `model-${n}`, img: `/models/model-${n}.jpg`, label: `Model ${n}` };
});

export default function ModelPicker({
  selected,
  customModelImage,
  onChange,
  onCustomImageChange,
}: ModelPickerProps) {
  const { t } = useLang();
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  const handleCustomUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result) {
        onCustomImageChange(ev.target.result as string);
        onChange("custom");
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const scroll = useCallback((dir: 1 | -1) => {
    if (!scrollRef.current) return;
    const card = scrollRef.current.querySelector("[data-card]") as HTMLElement | null;
    if (!card) return;
    scrollRef.current.scrollBy({ left: dir * (card.offsetWidth + 10), behavior: "smooth" });
  }, []);

  return (
    <>
      <div className="relative px-3">
        {/* Left arrow */}
        <button
          onClick={() => scroll(-1)}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 bg-surface border border-white/[0.12] rounded-full flex items-center justify-center text-text-secondary hover:text-white hover:border-white/30 transition-all"
        >
          <ChevronLeftIcon />
        </button>

        {/* Scrollable carousel */}
        <div
          ref={scrollRef}
          className="flex gap-2.5 overflow-x-auto scrollbar-hide py-2 -my-2"
        >
          {/* Custom upload card — FIRST */}
          <motion.button
            data-card
            onClick={() => {
              if (customModelImage) {
                onChange("custom");
              } else {
                inputRef.current?.click();
              }
            }}
            whileTap={{ scale: 0.97 }}
            whileHover={
              selected !== "custom"
                ? { boxShadow: "0 0 24px rgba(30,215,96,0.2)" }
                : {}
            }
            transition={{ duration: 0.12 }}
            className={`flex-shrink-0 relative rounded-card overflow-hidden focus:outline-none transition-all ${
              selected === "custom"
                ? "border-2 border-green shadow-glow-green"
                : "border-2 border-dashed border-green/40 hover:border-green/70"
            }`}
            style={{ aspectRatio: "3/4", width: "calc(40% - 4px)" }}
          >
            <div className="absolute inset-0 bg-surface" />
            {customModelImage ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={customModelImage}
                  alt="Custom model"
                  className="absolute inset-0 w-full h-full object-cover object-top"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent pt-4 pb-1.5 px-2">
                  <p className="text-green text-[10px] font-bold">{t.modelCustom1}</p>
                </div>
              </>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-2">
                <GreenPlusIcon />
                <p className="text-green text-[9px] text-center font-bold leading-snug">
                  {t.modelCustom1}
                  <br />
                  {t.modelCustom2}
                </p>
              </div>
            )}
            {selected === "custom" && (
              <div className="absolute top-1.5 right-1.5 pointer-events-none">
                <CheckBadge />
              </div>
            )}
          </motion.button>

          {/* Preset model cards */}
          {PRESETS.map((preset, idx) => (
            <div
              key={preset.id}
              data-card
              className={`flex-shrink-0 relative rounded-card overflow-hidden transition-shadow ${
                selected === preset.id
                  ? "border-2 border-green shadow-glow-green"
                  : "border-2 border-white/[0.10] hover:border-white/[0.25]"
              }`}
              style={{ aspectRatio: "3/4", width: "calc(40% - 4px)" }}
            >
              {/* Full-card selection button */}
              <button
                onClick={() => onChange(preset.id)}
                className="absolute inset-0 w-full h-full focus:outline-none"
              >
                <div className="absolute inset-0 bg-surface flex items-center justify-center text-text-muted">
                  <PersonIcon />
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={preset.img}
                  alt={preset.label}
                  className="absolute inset-0 w-full h-full object-cover object-top"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.opacity = "0";
                  }}
                />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent pt-4 pb-1.5 px-2">
                  <p className="text-white/70 text-[10px] font-bold">{preset.label}</p>
                </div>
              </button>

              {/* Checkmark */}
              {selected === preset.id && (
                <div className="absolute top-1.5 right-1.5 pointer-events-none z-10">
                  <CheckBadge />
                </div>
              )}

              {/* Eye icon — opens preview modal */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setPreviewIndex(idx);
                }}
                className="absolute top-1.5 left-1.5 w-5 h-5 bg-black/60 backdrop-blur-sm rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-black/80 transition-all z-10"
              >
                <EyeIcon />
              </button>
            </div>
          ))}
        </div>

        {/* Right arrow */}
        <button
          onClick={() => scroll(1)}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 bg-surface border border-white/[0.12] rounded-full flex items-center justify-center text-text-secondary hover:text-white hover:border-white/30 transition-all"
        >
          <ChevronRightIcon />
        </button>
      </div>

      {/* Fullscreen preview modal */}
      <AnimatePresence>
        {previewIndex !== null && (
          <ModelPreviewModal
            presets={PRESETS}
            initialIndex={previewIndex}
            onClose={() => setPreviewIndex(null)}
          />
        )}
      </AnimatePresence>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleCustomUpload}
      />
    </>
  );
}

function ModelPreviewModal({
  presets,
  initialIndex,
  onClose,
}: {
  presets: { id: string; img: string; label: string }[];
  initialIndex: number;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(initialIndex);
  const preset = presets[index];

  const prev = () => setIndex((i) => (i - 1 + presets.length) % presets.length);
  const next = () => setIndex((i) => (i + 1) % presets.length);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") setIndex((i) => (i - 1 + presets.length) % presets.length);
      if (e.key === "ArrowRight") setIndex((i) => (i + 1) % presets.length);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, presets.length]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.85)" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="relative flex flex-col items-center px-10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* X button */}
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 w-8 h-8 flex items-center justify-center text-white/50 hover:text-white transition-colors"
        >
          <XIcon />
        </button>

        {/* Image */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={preset.img}
          alt={preset.label}
          className="rounded-card object-cover object-top"
          style={{
            maxHeight: "80vh",
            maxWidth: "min(340px, 85vw)",
            width: "auto",
          }}
        />

        {/* Label */}
        <p className="text-white/60 text-sm font-bold mt-3">{preset.label}</p>

        {/* Nav arrows */}
        <div className="flex items-center gap-5 mt-3">
          <button
            onClick={prev}
            className="w-9 h-9 bg-surface border border-white/[0.12] rounded-full flex items-center justify-center text-text-secondary hover:text-white hover:border-white/30 transition-all"
          >
            <ChevronLeftIcon />
          </button>
          <span className="text-text-muted text-xs tabular-nums">
            {index + 1} / {presets.length}
          </span>
          <button
            onClick={next}
            className="w-9 h-9 bg-surface border border-white/[0.12] rounded-full flex items-center justify-center text-text-secondary hover:text-white hover:border-white/30 transition-all"
          >
            <ChevronRightIcon />
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function PersonIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 28 28" fill="none">
      <circle cx="14" cy="9" r="4.5" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M5 25c0-4.97 4.03-9 9-9s9 4.03 9 9"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function GreenPlusIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <path
        d="M11 4v14M4 11h14"
        stroke="#1ED760"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CheckBadge() {
  return (
    <div className="w-4 h-4 bg-green rounded-full flex items-center justify-center">
      <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
        <path
          d="M2 5l2.5 2.5L8 3"
          stroke="#0A0A0A"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

function EyeIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
      <path
        d="M1 7s2.333-4 6-4 6 4 6 4-2.333 4-6 4-6-4-6-4z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <circle cx="7" cy="7" r="1.5" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path
        d="M7.5 2L4 6l3.5 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path
        d="M4.5 2L8 6l-3.5 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M2 2l12 12M14 2L2 14"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
