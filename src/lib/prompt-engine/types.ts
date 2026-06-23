export const ecommercePlatforms = [
  "taobao",
  "tmall",
  "pinduoduo",
  "jd",
  "douyin",
  "kuaishou",
  "wechat",
] as const;

export type EcommercePlatform = (typeof ecommercePlatforms)[number];

export type PromptEngineInput = {
  product_name: string;
  category: string;
  highlights: string[];
};

export type PromptEngineOptions = {
  customRequirement?: string;
  detailEndId?: string;
  detailGenerationMode?: "modules" | "long";
  detailStartId?: string;
  generationMode?: "all" | "main" | "detail";
  listingImageCount?: number;
  listingImageRoles?: ListingImageRole[];
  platform?: EcommercePlatform;
  referenceImageNotes?: string;
  referenceInfluence?: number;
  language?: "zh-CN" | "en-US";
  mainImageCount?: number;
};

export type ListingImageRole =
  | "benefit"
  | "feature"
  | "dimension"
  | "lifestyle"
  | "detail"
  | "comparison"
  | "how_to_use"
  | "package";

export type ListingImagePrompt = {
  id: string;
  role: ListingImageRole;
  title: string;
  prompt: string;
};

export type MainImagePrompt = {
  id: string;
  title: string;
  prompt: string;
};

export type PromptEngineOutput = {
  mainImagePrompt: string;
  mainImagePrompts: MainImagePrompt[];
  listingImagePrompts: ListingImagePrompt[];
  lifestylePrompt: string;
  infographicPrompt: string;
  detailPagePrompt: string;
  detailPageModules: DetailPageModulePrompt[];
};

export type PromptRole =
  | "mainImagePrompt"
  | "lifestylePrompt"
  | "infographicPrompt"
  | "detailPagePrompt";

export type DetailPageModulePrompt = {
  id: string;
  title: string;
  description: string;
  imagePrompt: string;
};

export type PlatformPromptProfile = {
  id: EcommercePlatform;
  label: string;
  imageRules: string[];
  visualTone: string[];
  buyerConcernRules: string[];
  layoutRules: string[];
  visualProofRules: string[];
  negativeRules: string[];
  copyRules: string[];
  detailPageRules: string[];
};
