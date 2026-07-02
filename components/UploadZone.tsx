"use client";

import { useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { useLang } from "@/contexts/LangContext";

interface UploadZoneProps {
  images: string[];
  onChange: (images: string[]) => void;
  maxImages?: number;
}

export default function UploadZone({
  images,
  onChange,
  maxImages = 4,
}: UploadZoneProps) {
  const { t } = useLang();
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFiles = useCallback(
    (files: FileList | File[]) => {
      const fileArray = Array.from(files).filter(
        (f) =>
          f.type === "image/jpeg" ||
          f.type === "image/png" ||
          f.type === "image/webp"
      );
      const remaining = maxImages - images.length;
      const toProcess = fileArray.slice(0, remaining);

      toProcess.forEach((file) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          if (e.target?.result) {
            onChange([...images, e.target.result as string]);
          }
        };
        reader.readAsDataURL(file);
      });
    },
    [images, maxImages, onChange]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    processFiles(e.dataTransfer.files);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) processFiles(e.target.files);
    e.target.value = "";
  };

  const removeImage = (index: number) => {
    onChange(images.filter((_, i) => i !== index));
  };

  const canAddMore = images.length < maxImages;

  return (
    <div>
      {images.length === 0 ? (
        <motion.div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          animate={{
            boxShadow: isDragging
              ? "0 0 24px rgba(30,215,96,0.3)"
              : "0 0 0px rgba(30,215,96,0)",
          }}
          whileHover={{ boxShadow: "0 0 24px rgba(30,215,96,0.3)" }}
          transition={{ duration: 0.15 }}
          className="border-2 border-dashed border-green rounded-card bg-surface cursor-pointer p-14 flex flex-col items-center justify-center gap-3"
        >
          <div className="w-12 h-12 rounded-full bg-green/[0.08] flex items-center justify-center">
            <UploadIcon />
          </div>
          <div className="text-center">
            <p className="text-text-secondary text-sm font-bold">
              {isDragging ? t.uploadDragging : t.uploadLabel}
            </p>
            <p className="text-text-muted text-xs mt-1">{t.uploadHint}</p>
          </div>
        </motion.div>
      ) : (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="grid grid-cols-2 gap-2">
            {images.map((src, i) => (
              <motion.div
                key={`${src.slice(-20)}-${i}`}
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.2 }}
                className="relative aspect-square rounded-card overflow-hidden bg-surface border border-white/[0.06]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt={`Upload ${i + 1}`}
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeImage(i);
                  }}
                  className="absolute top-2 right-2 w-6 h-6 bg-black/70 rounded-full flex items-center justify-center text-white text-sm hover:bg-black transition-colors leading-none"
                >
                  ×
                </button>
              </motion.div>
            ))}
            {canAddMore && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={() => inputRef.current?.click()}
                className="aspect-square rounded-card border-2 border-dashed border-white/[0.10] bg-surface flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-white/[0.25] transition-colors"
              >
                <span className="text-text-muted text-2xl leading-none">+</span>
                <span className="text-text-muted text-xs">{t.uploadAddMore}</span>
              </motion.div>
            )}
          </div>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}

function UploadIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path
        d="M10 13V4M10 4L7 7M10 4L13 7"
        stroke="#1ED760"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3 14.5V16C3 16.5523 3.44772 17 4 17H16C16.5523 17 17 16.5523 17 16V14.5"
        stroke="#1ED760"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
