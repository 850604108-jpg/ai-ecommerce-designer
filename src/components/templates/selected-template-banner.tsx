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
    <div className="rounded-md border bg-card p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Sparkles aria-hidden="true" className="size-4" />
            {dictionary.templates.selected}
          </div>
          <h2 className="text-lg font-semibold">{selectedTemplate.name}</h2>
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
      <p className="mt-3 rounded-md bg-secondary p-3 text-xs leading-5 text-muted-foreground">
        {selectedTemplate.prompt}
      </p>
    </div>
  );
}
