export const generatedImageTypes = [
  "main_image",
  "lifestyle",
  "infographic",
  "detail_page_module",
] as const;

export type GeneratedImageType = (typeof generatedImageTypes)[number];

export type GeneratedImageStatus =
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | "deleted";

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
};

export const imageGenerationCreditCosts: Record<GeneratedImageType, number> = {
  main_image: 1,
  lifestyle: 2,
  infographic: 2,
  detail_page_module: 3,
};

export function isGeneratedImageType(
  value: unknown,
): value is GeneratedImageType {
  return (
    typeof value === "string" &&
    generatedImageTypes.includes(value as GeneratedImageType)
  );
}
