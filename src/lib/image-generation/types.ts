export const generatedImageTypes = [
  "main_image",
  "lifestyle",
  "infographic",
  "detail_page_module",
  "detail_page_long",
] as const;

export type GeneratedImageType = (typeof generatedImageTypes)[number];

export type GeneratedImageStatus =
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | "deleted";

export const generatedImageSizes = [
  "1024x1024",
  "1024x1536",
  "1536x1024",
] as const;

export type GeneratedImageSize = (typeof generatedImageSizes)[number];

export type GeneratedImageJob = {
  id: string;
  project_id?: string;
  prompt: string;
  model: string;
  storage_bucket: string;
  storage_path: string | null;
  status: GeneratedImageStatus;
  width: number | null;
  height: number | null;
  credits_spent: number;
  error_message: string | null;
  generation_params: Record<string, unknown>;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  public_url?: string | null;
};

export type GeneratedImageHistoryProject = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  created_at: string;
};

export type GeneratedImageHistoryJob = GeneratedImageJob & {
  project_id: string;
  project: GeneratedImageHistoryProject | null;
};

export const generatedImageTypeLabels: Record<GeneratedImageType, string> = {
  main_image: "主图",
  lifestyle: "场景图",
  infographic: "信息图",
  detail_page_module: "详情页模块",
  detail_page_long: "9:32详情页长图",
};

export const imageGenerationCreditCosts: Record<GeneratedImageType, number> = {
  main_image: 1,
  lifestyle: 2,
  infographic: 2,
  detail_page_module: 3,
  detail_page_long: 3,
};

export function isGeneratedImageType(
  value: unknown,
): value is GeneratedImageType {
  return (
    typeof value === "string" &&
    generatedImageTypes.includes(value as GeneratedImageType)
  );
}

export function isGeneratedImageSize(
  value: unknown,
): value is GeneratedImageSize {
  return (
    typeof value === "string" &&
    generatedImageSizes.includes(value as GeneratedImageSize)
  );
}
