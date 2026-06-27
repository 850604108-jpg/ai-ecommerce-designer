"use client";

import { useEffect, useState } from "react";
import { Copy, Sparkles } from "lucide-react";
import { useSearchParams } from "next/navigation";

import { useLanguage } from "@/components/i18n/language-provider";
import { Button } from "@/components/ui/button";
import { loadSelectedTemplate, loadTemplates } from "@/lib/templates/storage";
import { categoryLabels } from "@/lib/templates/types";

type SelectedTemplate = NonNullable<ReturnType<typeof loadSelectedTemplate>>;

export function SelectedTemplateBanner() {
  const { dictionary } = useLanguage();
  const searchParams = useSearchParams();
  const templateId = searchParams.get("template") || undefined;
  const [selectedTemplate, setSelectedTemplate] =
    useState<SelectedTemplate | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const storedTemplate = loadSelectedTemplate();

    if (storedTemplate?.id === templateId || !templateId) {
      setSelectedTemplate(storedTemplate);
      return;
    }

    const matchedTemplate = loadTemplates().find(
      (template) => template.id === templateId,
    );

    setSelectedTemplate(
      matchedTemplate
        ? {
            id: matchedTemplate.id,
            name: matchedTemplate.name,
            category: matchedTemplate.category,
            prompt: matchedTemplate.prompt,
          }
        : storedTemplate,
    );
  }, [templateId]);

  if (!selectedTemplate) {
    return null;
  }

  async function copyPrompt() {
    if (!selectedTemplate) {
      return;
    }

    await navigator.clipboard.writeText(selectedTemplate.prompt);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="animate-fade-slide-up interactive-card rounded-xl border border-border/80 bg-card/85 p-4 shadow-sm backdrop-blur">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-muted-foreground">
            <Sparkles
              aria-hidden="true"
              className="size-3.5 text-[var(--signal-violet)]"
            />
            {dictionary.templates.selected}
          </div>
          <h2 className="text-lg font-semibold tracking-tight">
            {selectedTemplate.name}
          </h2>
          <p className="text-sm text-muted-foreground">
            {dictionary.templates.category(
              categoryLabels[selectedTemplate.category],
            )}
          </p>
        </div>
        <Button onClick={copyPrompt} size="sm" type="button" variant="outline">
          <Copy aria-hidden="true" />
          {copied ? dictionary.templates.copied : dictionary.templates.copyPrompt}
        </Button>
      </div>
      <p className="mt-3 max-h-32 overflow-auto rounded-lg border border-border/70 bg-secondary/70 p-3 text-xs leading-5 text-muted-foreground">
        {selectedTemplate.prompt}
      </p>
    </div>
  );
}
