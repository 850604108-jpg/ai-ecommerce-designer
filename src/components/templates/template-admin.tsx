"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Check, Pencil, Plus, Save, Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import { loadTemplates, saveTemplates } from "@/lib/templates/storage";
import {
  categoryLabels,
  templateCategories,
  type MarketplaceTemplate,
  type TemplateCategory,
} from "@/lib/templates/types";
import { cn } from "@/lib/utils";

type TemplateFormState = {
  id?: string;
  name: string;
  category: TemplateCategory;
  description: string;
  prompt: string;
  preview: string;
  tags: string;
  isFeatured: boolean;
  isActive: boolean;
};

const emptyForm: TemplateFormState = {
  name: "",
  category: "electronics",
  description: "",
  prompt: "",
  preview: "linear-gradient(135deg, #f8fafc 0%, #cbd5e1 50%, #334155 100%)",
  tags: "",
  isFeatured: false,
  isActive: true,
};

function slugify(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || `template-${Date.now()}`
  );
}

function templateToForm(template: MarketplaceTemplate): TemplateFormState {
  return {
    id: template.id,
    name: template.name,
    category: template.category,
    description: template.description,
    prompt: template.prompt,
    preview: template.preview,
    tags: template.tags.join(", "),
    isFeatured: template.isFeatured,
    isActive: template.isActive,
  };
}

export function TemplateAdmin() {
  const [templates, setTemplates] = useState<MarketplaceTemplate[]>([]);
  const [form, setForm] = useState<TemplateFormState>(emptyForm);
  const [savedMessage, setSavedMessage] = useState("");

  useEffect(() => {
    setTemplates(loadTemplates());
  }, []);

  const stats = useMemo(() => {
    return templateCategories.map((category) => ({
      category,
      activeCount: templates.filter(
        (template) => template.category === category && template.isActive,
      ).length,
      totalCount: templates.filter((template) => template.category === category)
        .length,
    }));
  }, [templates]);

  function updateForm<K extends keyof TemplateFormState>(
    key: K,
    value: TemplateFormState[K],
  ) {
    setSavedMessage("");
    setForm((currentForm) => ({ ...currentForm, [key]: value }));
  }

  function persist(nextTemplates: MarketplaceTemplate[], message: string) {
    setTemplates(nextTemplates);
    saveTemplates(nextTemplates);
    setSavedMessage(message);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const now = new Date().toISOString().slice(0, 10);
    const nextTemplate: MarketplaceTemplate = {
      id: form.id || `${form.category}-${slugify(form.name)}`,
      name: form.name.trim(),
      category: form.category,
      description: form.description.trim(),
      prompt: form.prompt.trim(),
      preview: form.preview.trim(),
      tags: form.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      isFeatured: form.isFeatured,
      isActive: form.isActive,
      updatedAt: now,
    };

    const exists = templates.some((template) => template.id === nextTemplate.id);
    const nextTemplates = exists
      ? templates.map((template) =>
          template.id === nextTemplate.id ? nextTemplate : template,
        )
      : [nextTemplate, ...templates];

    persist(nextTemplates, exists ? "模板已更新。" : "模板已新增。");
    setForm(emptyForm);
  }

  function toggleActive(template: MarketplaceTemplate) {
    persist(
      templates.map((currentTemplate) =>
        currentTemplate.id === template.id
          ? {
              ...currentTemplate,
              isActive: !currentTemplate.isActive,
              updatedAt: new Date().toISOString().slice(0, 10),
            }
          : currentTemplate,
      ),
      template.isActive ? "模板已停用。" : "模板已启用。",
    );
  }

  function toggleFeatured(template: MarketplaceTemplate) {
    persist(
      templates.map((currentTemplate) =>
        currentTemplate.id === template.id
          ? {
              ...currentTemplate,
              isFeatured: !currentTemplate.isFeatured,
              updatedAt: new Date().toISOString().slice(0, 10),
            }
          : currentTemplate,
      ),
      template.isFeatured ? "已取消精选。" : "已设为精选。",
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <aside className="space-y-4">
        <div className="rounded-md border bg-card p-4">
          <h2 className="text-lg font-semibold">分类概览</h2>
          <div className="mt-4 grid gap-2">
            {stats.map((item) => (
              <div
                className="flex items-center justify-between rounded-md bg-secondary px-3 py-2 text-sm"
                key={item.category}
              >
                <span>{categoryLabels[item.category]}</span>
                <span className="text-muted-foreground">
                  {item.activeCount}/{item.totalCount} 启用
                </span>
              </div>
            ))}
          </div>
        </div>

        <form className="rounded-md border bg-card p-4" onSubmit={handleSubmit}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">
              {form.id ? "编辑模板" : "新增模板"}
            </h2>
            {form.id ? (
              <Button
                onClick={() => setForm(emptyForm)}
                size="sm"
                type="button"
                variant="outline"
              >
                <Plus aria-hidden="true" />
                新建
              </Button>
            ) : null}
          </div>

          <div className="mt-4 space-y-3">
            <label className="grid gap-1 text-sm font-medium">
              模板名称
              <input
                className="h-10 rounded-md border bg-background px-3 text-sm font-normal outline-none focus:ring-2 focus:ring-ring"
                onChange={(event) => updateForm("name", event.target.value)}
                required
                value={form.name}
              />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              分类
              <select
                className="h-10 rounded-md border bg-background px-3 text-sm font-normal outline-none focus:ring-2 focus:ring-ring"
                onChange={(event) =>
                  updateForm("category", event.target.value as TemplateCategory)
                }
                value={form.category}
              >
                {templateCategories.map((category) => (
                  <option key={category} value={category}>
                    {categoryLabels[category]}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-medium">
              描述
              <textarea
                className="min-h-20 rounded-md border bg-background px-3 py-2 text-sm font-normal outline-none focus:ring-2 focus:ring-ring"
                onChange={(event) =>
                  updateForm("description", event.target.value)
                }
                required
                value={form.description}
              />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              提示词
              <textarea
                className="min-h-28 rounded-md border bg-background px-3 py-2 text-sm font-normal outline-none focus:ring-2 focus:ring-ring"
                onChange={(event) => updateForm("prompt", event.target.value)}
                required
                value={form.prompt}
              />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              预览背景 CSS
              <input
                className="h-10 rounded-md border bg-background px-3 text-sm font-normal outline-none focus:ring-2 focus:ring-ring"
                onChange={(event) => updateForm("preview", event.target.value)}
                required
                value={form.preview}
              />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              标签，逗号分隔
              <input
                className="h-10 rounded-md border bg-background px-3 text-sm font-normal outline-none focus:ring-2 focus:ring-ring"
                onChange={(event) => updateForm("tags", event.target.value)}
                value={form.tags}
              />
            </label>
            <div className="grid gap-2 text-sm">
              <label className="flex items-center gap-2">
                <input
                  checked={form.isFeatured}
                  onChange={(event) =>
                    updateForm("isFeatured", event.target.checked)
                  }
                  type="checkbox"
                />
                精选模板
              </label>
              <label className="flex items-center gap-2">
                <input
                  checked={form.isActive}
                  onChange={(event) =>
                    updateForm("isActive", event.target.checked)
                  }
                  type="checkbox"
                />
                前台启用
              </label>
            </div>
            <Button className="w-full" type="submit">
              <Save aria-hidden="true" />
              保存模板
            </Button>
            {savedMessage ? (
              <p className="flex items-center gap-2 rounded-md bg-secondary p-3 text-sm">
                <Check aria-hidden="true" className="size-4" />
                {savedMessage}
              </p>
            ) : null}
          </div>
        </form>
      </aside>

      <div className="rounded-md border bg-card">
        <div className="border-b p-4">
          <h2 className="text-lg font-semibold">模板列表</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            可编辑模板内容、设置精选，或停用模板以从前台隐藏。
          </p>
        </div>
        <div className="divide-y">
          {templates.map((template) => (
            <div className="grid gap-4 p-4 md:grid-cols-[160px_1fr]" key={template.id}>
              <div
                className="h-28 rounded-md"
                style={{ background: template.preview }}
              />
              <div className="space-y-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{template.name}</h3>
                      <span className="rounded-md bg-secondary px-2 py-1 text-xs text-muted-foreground">
                        {categoryLabels[template.category]}
                      </span>
                      <span
                        className={cn(
                          "rounded-md px-2 py-1 text-xs",
                          template.isActive
                            ? "bg-green-50 text-green-700"
                            : "bg-secondary text-muted-foreground",
                        )}
                      >
                        {template.isActive ? "启用" : "停用"}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {template.description}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      更新于 {template.updatedAt}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={() => setForm(templateToForm(template))}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      <Pencil aria-hidden="true" />
                      编辑
                    </Button>
                    <Button
                      onClick={() => toggleFeatured(template)}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      <Star
                        aria-hidden="true"
                        className={template.isFeatured ? "fill-current" : ""}
                      />
                      {template.isFeatured ? "取消精选" : "设为精选"}
                    </Button>
                    <Button
                      onClick={() => toggleActive(template)}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      {template.isActive ? "停用" : "启用"}
                    </Button>
                  </div>
                </div>
                <p className="line-clamp-2 rounded-md bg-secondary p-3 text-xs leading-5 text-muted-foreground">
                  {template.prompt}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
