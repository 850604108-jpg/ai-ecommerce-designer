"use client";

import { defaultTemplates } from "@/lib/templates/data";
import type { MarketplaceTemplate } from "@/lib/templates/types";

const templatesKey = "template-marketplace.templates";
const favoritesKey = "template-marketplace.favorites";
const selectedTemplateKey = "template-marketplace.selected";

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function loadTemplates() {
  const templates = readJson<MarketplaceTemplate[]>(templatesKey, []);

  if (!templates.length) {
    writeJson(templatesKey, defaultTemplates);
    return defaultTemplates;
  }

  return templates;
}

export function saveTemplates(templates: MarketplaceTemplate[]) {
  writeJson(templatesKey, templates);
}

export function loadFavoriteTemplateIds() {
  return readJson<string[]>(favoritesKey, []);
}

export function saveFavoriteTemplateIds(ids: string[]) {
  writeJson(favoritesKey, ids);
}

export function saveSelectedTemplate(template: MarketplaceTemplate) {
  writeJson(selectedTemplateKey, {
    id: template.id,
    name: template.name,
    category: template.category,
    prompt: template.prompt,
  });
}

export function loadSelectedTemplate() {
  return readJson<{
    id: string;
    name: string;
    category: MarketplaceTemplate["category"];
    prompt: string;
  } | null>(selectedTemplateKey, null);
}
