export const templateCategories = [
  "electronics",
  "fashion",
  "home",
  "beauty",
  "pets",
] as const;

export type TemplateCategory = (typeof templateCategories)[number];

export type MarketplaceTemplate = {
  id: string;
  name: string;
  category: TemplateCategory;
  description: string;
  prompt: string;
  preview: string;
  tags: string[];
  isFeatured: boolean;
  isActive: boolean;
  updatedAt: string;
};

export const categoryLabels: Record<TemplateCategory, string> = {
  electronics: "电子产品",
  fashion: "服饰",
  home: "家居",
  beauty: "美妆",
  pets: "宠物",
};
