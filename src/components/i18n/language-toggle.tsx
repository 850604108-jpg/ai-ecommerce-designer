"use client";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/i18n/language-provider";

export function LanguageToggle() {
  const router = useRouter();
  const { dictionary, language, setLanguage } = useLanguage();
  const nextLanguage = language === "en" ? "zh" : "en";

  return (
    <Button
      aria-label={dictionary.language.label}
      onClick={() => {
        setLanguage(nextLanguage);
        router.refresh();
      }}
      size="sm"
      type="button"
      variant="outline"
    >
      {nextLanguage === "zh"
        ? dictionary.language.switchToChinese
        : dictionary.language.switchToEnglish}
    </Button>
  );
}
