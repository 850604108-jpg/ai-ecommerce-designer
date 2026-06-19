"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  defaultLanguage,
  dictionaries,
  languageCookieName,
  resolveLanguage,
  type Dictionary,
  type Language,
} from "@/lib/i18n";

type LanguageContextValue = {
  dictionary: Dictionary;
  language: Language;
  setLanguage: (language: Language) => void;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

function persistLanguage(language: Language) {
  document.cookie = `${languageCookieName}=${language}; path=/; max-age=31536000; SameSite=Lax`;
  window.localStorage.setItem(languageCookieName, language);
  document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
}

export function LanguageProvider({
  children,
  initialLanguage = defaultLanguage,
}: {
  children: ReactNode;
  initialLanguage?: Language;
}) {
  const [language, setLanguageState] = useState(initialLanguage);

  useEffect(() => {
    const storedLanguage = resolveLanguage(
      window.localStorage.getItem(languageCookieName),
    );

    if (storedLanguage !== language) {
      setLanguageState(storedLanguage);
      persistLanguage(storedLanguage);
      return;
    }

    persistLanguage(language);
  }, [language]);

  const value = useMemo<LanguageContextValue>(
    () => ({
      dictionary: dictionaries[language],
      language,
      setLanguage: (nextLanguage) => {
        setLanguageState(nextLanguage);
        persistLanguage(nextLanguage);
      },
    }),
    [language],
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);

  if (!context) {
    throw new Error("useLanguage must be used inside LanguageProvider.");
  }

  return context;
}
