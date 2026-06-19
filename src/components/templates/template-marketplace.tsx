"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Eye,
  Heart,
  Search,
  Sparkles,
  Star,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";

import { useLanguage } from "@/components/i18n/language-provider";
import { Button } from "@/components/ui/button";
import {
  loadFavoriteTemplateIds,
  loadTemplates,
  saveFavoriteTemplateIds,
  saveSelectedTemplate,
} from "@/lib/templates/storage";
import {
  categoryLabels,
  templateCategories,
  type MarketplaceTemplate,
  type TemplateCategory,
} from "@/lib/templates/types";
import { cn } from "@/lib/utils";

type CategoryFilter = TemplateCategory | "all" | "favorites";

export function TemplateMarketplace() {
  const { dictionary } = useLanguage();
  const router = useRouter();
  const [templates, setTemplates] = useState<MarketplaceTemplate[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>("all");
  const [query, setQuery] = useState("");
  const [previewTemplate, setPreviewTemplate] =
    useState<MarketplaceTemplate | null>(null);

  useEffect(() => {
    setTemplates(loadTemplates());
    setFavoriteIds(loadFavoriteTemplateIds());
  }, []);

  const activeTemplates = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return templates
      .filter((template) => template.isActive)
      .filter((template) => {
        if (activeCategory === "favorites") {
          return favoriteIds.includes(template.id);
        }

        if (activeCategory === "all") {
          return true;
        }

        return template.category === activeCategory;
      })
      .filter((template) => {
        if (!normalizedQuery) {
          return true;
        }

        const searchable = [
          template.name,
          template.description,
          categoryLabels[template.category],
          ...template.tags,
        ]
          .join(" ")
          .toLowerCase();

        return searchable.includes(normalizedQuery);
      })
      .sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured));
  }, [activeCategory, favoriteIds, query, templates]);

  const categoryOptions = useMemo<{ label: string; value: CategoryFilter }[]>(
    () => [
      { label: dictionary.templates.all, value: "all" },
      ...templateCategories.map((category) => ({
        label: categoryLabels[category],
        value: category,
      })),
      { label: dictionary.templates.favorites, value: "favorites" },
    ],
    [dictionary],
  );

  function toggleFavorite(templateId: string) {
    setFavoriteIds((currentIds) => {
      const nextIds = currentIds.includes(templateId)
        ? currentIds.filter((id) => id !== templateId)
        : [...currentIds, templateId];

      saveFavoriteTemplateIds(nextIds);
      return nextIds;
    });
  }

  function handleUseTemplate(template: MarketplaceTemplate) {
    saveSelectedTemplate(template);
    router.push(`/generate?template=${encodeURIComponent(template.id)}`);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-md border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search
            aria-hidden="true"
            className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <input
            className="h-10 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            onChange={(event) => setQuery(event.target.value)}
            placeholder={dictionary.templates.searchPlaceholder}
            value={query}
          />
        </div>
        <Button asChild variant="outline">
          <a href="/admin/templates">{dictionary.templates.admin}</a>
        </Button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {categoryOptions.map((category) => (
          <button
            className={cn(
              "h-9 shrink-0 rounded-md border px-3 text-sm font-medium transition-colors",
              activeCategory === category.value
                ? "bg-primary text-primary-foreground"
                : "bg-background hover:bg-accent",
            )}
            key={category.value}
            onClick={() => setActiveCategory(category.value)}
            type="button"
          >
            {category.label}
          </button>
        ))}
      </div>

      {activeTemplates.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {activeTemplates.map((template) => {
            const isFavorite = favoriteIds.includes(template.id);

            return (
              <article className="rounded-md border bg-card" key={template.id}>
                <div
                  className="flex h-36 items-end rounded-t-md p-4 text-white"
                  style={{ background: template.preview }}
                >
                  <div className="space-y-2">
                    <span className="inline-flex rounded-md bg-black/25 px-2 py-1 text-xs font-medium backdrop-blur">
                      {categoryLabels[template.category]}
                    </span>
                    <h2 className="text-lg font-semibold">{template.name}</h2>
                  </div>
                </div>
                <div className="space-y-4 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm leading-6 text-muted-foreground">
                      {template.description}
                    </p>
                    {template.isFeatured ? (
                      <Star
                        aria-label={dictionary.templates.featured}
                        className="mt-1 size-4 shrink-0 fill-current"
                      />
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {template.tags.map((tag) => (
                      <span
                        className="rounded-md bg-secondary px-2 py-1 text-xs text-muted-foreground"
                        key={tag}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={() => setPreviewTemplate(template)}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      <Eye aria-hidden="true" />
                      {dictionary.templates.preview}
                    </Button>
                    <Button
                      aria-pressed={isFavorite}
                      onClick={() => toggleFavorite(template.id)}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      <Heart
                        aria-hidden="true"
                        className={isFavorite ? "fill-current" : ""}
                      />
                      {dictionary.templates.favorite}
                    </Button>
                    <Button
                      onClick={() => handleUseTemplate(template)}
                      size="sm"
                      type="button"
                    >
                      {dictionary.templates.use}
                      <ArrowRight aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="rounded-md border bg-card p-8 text-center">
          <Sparkles
            aria-hidden="true"
            className="mx-auto size-8 text-muted-foreground"
          />
          <h2 className="mt-4 text-lg font-semibold">
            {dictionary.templates.emptyTitle}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {dictionary.templates.emptyDescription}
          </p>
        </div>
      )}

      {previewTemplate ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
          role="dialog"
        >
          <div className="w-full max-w-2xl rounded-md border bg-background shadow-lg">
            <div className="flex items-center justify-between border-b p-4">
              <div>
                <p className="text-sm text-muted-foreground">
                  {categoryLabels[previewTemplate.category]}
                </p>
                <h2 className="text-xl font-semibold">
                  {previewTemplate.name}
                </h2>
              </div>
              <Button
                aria-label={dictionary.templates.closePreview}
                onClick={() => setPreviewTemplate(null)}
                size="icon"
                type="button"
                variant="ghost"
              >
                <X aria-hidden="true" />
              </Button>
            </div>
            <div className="grid gap-4 p-4 sm:grid-cols-[220px_1fr]">
              <div
                className="h-56 rounded-md"
                style={{ background: previewTemplate.preview }}
              />
              <div className="space-y-4">
                <p className="text-sm leading-6 text-muted-foreground">
                  {previewTemplate.description}
                </p>
                <div className="rounded-md bg-secondary p-3">
                  <h3 className="text-sm font-medium">
                    {dictionary.templates.prompt}
                  </h3>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    {previewTemplate.prompt}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => toggleFavorite(previewTemplate.id)}
                    type="button"
                    variant="outline"
                  >
                    <Heart
                      aria-hidden="true"
                      className={
                        favoriteIds.includes(previewTemplate.id)
                          ? "fill-current"
                          : ""
                      }
                    />
                    {dictionary.templates.favorite}
                  </Button>
                  <Button
                    onClick={() => handleUseTemplate(previewTemplate)}
                    type="button"
                  >
                    {dictionary.templates.use}
                    <ArrowRight aria-hidden="true" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
