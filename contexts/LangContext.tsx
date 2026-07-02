"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { translations, type Lang, type T } from "@/lib/i18n";

interface LangContextValue {
  uiLang: Lang;
  setUiLang: (lang: Lang) => void;
  t: T;
}

const LangContext = createContext<LangContextValue | null>(null);

export function LangProvider({ children }: { children: ReactNode }) {
  const [uiLang, setUiLang] = useState<Lang>("en");
  return (
    <LangContext.Provider value={{ uiLang, setUiLang, t: translations[uiLang] as T }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang(): LangContextValue {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLang must be used within LangProvider");
  return ctx;
}
