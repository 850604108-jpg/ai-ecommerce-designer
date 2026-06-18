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
  platform?: EcommercePlatform;
  language?: "zh-CN" | "en-US";
};

export type PromptEngineOutput = {
  mainImagePrompt: string;
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
  copyRules: string[];
  detailPageRules: string[];
};
