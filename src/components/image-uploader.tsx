"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  Coins,
  Copy,
  Download,
  FileText,
  ImagePlus,
  Loader2,
  RefreshCw,
  ScanSearch,
  Upload,
  WandSparkles,
  XCircle,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { useBackgroundGeneration } from "@/components/generation/background-generation-provider";
import { useLanguage } from "@/components/i18n/language-provider";
import { Button } from "@/components/ui/button";
import {
  downloadImageAsset,
  downloadImageBatch,
  imageDownloadFormats,
  type DownloadableImage,
  type ImageDownloadFormat,
} from "@/lib/download-images";
import {
  ecommercePlatforms,
  type EcommercePlatform,
  type ListingImageRole,
  type PromptEngineOutput,
} from "@/lib/prompt-engine";
import {
  imageGenerationCreditCosts,
  isGeneratedImageSize,
  isGeneratedImageType,
  type GeneratedImageSize,
  type GeneratedImageJob,
  type GeneratedImageType,
} from "@/lib/image-generation/types";
import { cn } from "@/lib/utils";

const allowedTypes = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

const allowedExtensions = new Set(["jpg", "jpeg", "png", "webp"]);
const promptGenerationCreditCost = 3;
type UploadResult = {
  imageUrl: string;
  recognition?: ProductRecognitionResult;
  recognitionWarning?: string | null;
};

type UploadState = "idle" | "ready" | "uploading" | "success" | "error";

type ProductRecognitionResult = {
  id: string;
  image_url: string;
  product_name: string;
  category: string;
  target_user: string;
  highlights: string[];
  created_at: string;
};

const emptyPromptOutput: PromptEngineOutput = {
  detailPageModules: [],
  detailPagePrompt: "",
  infographicPrompt: "",
  lifestylePrompt: "",
  listingImagePrompts: [],
  mainImagePrompt: "",
  mainImagePrompts: [],
};

type RecognitionState = "idle" | "recognizing" | "success" | "error";

type PromptState = "idle" | "generating" | "success" | "error";

type ImageQueueState = "idle" | "queueing" | "processing" | "success" | "error";

type ExportState = "idle" | "exporting" | "error";
type GenerationMode = "main" | "detail";
type DetailGenerationMode = "modules" | "long";
type ReferenceStyleImage = {
  fileName: string;
  imageUrl: string;
};
type ImagePreviewState = {
  alt: string;
  src: string;
};
type ImageUploaderGenerationDraft = {
  customRequirement: string;
  detailAspect: (typeof detailAspectOptions)[number]["value"];
  detailEndId: string;
  detailGenerationMode: DetailGenerationMode;
  detailPageExportError: string;
  detailPageExportStatus: ExportState;
  detailStartId: string;
  error: string;
  generatedImageJobs: GeneratedImageJob[];
  generationMode: GenerationMode;
  imageQueueError: string;
  imageQueueStatus: ImageQueueState;
  isGenerationPanelMinimized: boolean;
  listingImageCount: number;
  listingImageRoles: ListingImageRole[];
  previewUrl: string;
  progress: number;
  promptError: string;
  promptStatus: PromptState;
  prompts: PromptEngineOutput | null;
  recognitionStatus: RecognitionState;
  referenceImageNotes: string;
  referenceInfluence: number;
  referenceStyleError: string;
  referenceStyleImage: ReferenceStyleImage | null;
  referenceStyleUploadStatus: UploadState;
  result: UploadResult | null;
  selectedPlatform: EcommercePlatform;
  status: UploadState;
};

const listingImageCountOptions = [1, 2, 3, 4, 5, 6, 7] as const;
const listingImageRoleOptions: Array<{
  label: string;
  value: ListingImageRole;
}> = [
  { label: "核心卖点/利益图", value: "benefit" },
  { label: "功能拆解/结构证明图", value: "feature" },
  { label: "尺寸/规格/适配图", value: "dimension" },
  { label: "场景使用图", value: "lifestyle" },
  { label: "细节特写/局部放大图", value: "detail" },
  { label: "对比图", value: "comparison" },
  { label: "使用步骤/流程图", value: "how_to_use" },
  { label: "包装/全家福图", value: "package" },
];
const defaultListingImageRoles: ListingImageRole[] = [
  "benefit",
  "feature",
  "dimension",
  "lifestyle",
  "detail",
  "comparison",
  "how_to_use",
];
const detailModuleIds = [
  "AD-01",
  "AD-02",
  "AD-03",
  "AD-04",
  "AD-05",
  "AD-06",
  "AD-07",
] as const;

const detailAspectOptions: Array<{
  label: string;
  size: GeneratedImageSize;
  value: "wide" | "square" | "vertical";
}> = [
  { label: "横版 3:2", size: "1536x1024", value: "wide" },
  { label: "方图 1:1", size: "1024x1024", value: "square" },
  { label: "竖版 2:3", size: "1024x1536", value: "vertical" },
];

const platformLabels: Record<EcommercePlatform, string> = {
  taobao: "淘宝",
  tmall: "天猫",
  pinduoduo: "拼多多",
  jd: "京东",
  douyin: "抖音电商",
  kuaishou: "快手电商",
  wechat: "微信小店",
};

function isEcommercePlatformValue(value: unknown): value is EcommercePlatform {
  return (
    typeof value === "string" &&
    ecommercePlatforms.includes(value as EcommercePlatform)
  );
}

function isAllowedImage(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase();

  return (
    allowedTypes.has(file.type) &&
    Boolean(extension && allowedExtensions.has(extension))
  );
}

function uploadToSupabaseStorage(
  file: File,
  onProgress: (progress: number) => void,
) {
  return new Promise<UploadResult>(async (resolve, reject) => {
    try {
      const request = new XMLHttpRequest();
      const formData = new FormData();

      formData.append("image", file);

      request.upload.onprogress = (event) => {
        if (!event.lengthComputable) {
          return;
        }

        onProgress(Math.round((event.loaded / event.total) * 100));
      };

      request.onerror = () => {
        reject(new Error("Upload failed. Please try again."));
      };

      request.onload = () => {
        if (request.status < 200 || request.status >= 300) {
          let message = "Upload failed. Please check your storage policy.";

          try {
            const response = JSON.parse(request.responseText) as {
              error?: string;
              imageUrl?: string;
              message?: string;
            };
            message = response.message || response.error || message;
          } catch {
            // Keep the fallback message when Supabase returns plain text.
          }

          reject(new Error(message));
          return;
        }

        let imageUrl = "";

        try {
          const response = JSON.parse(request.responseText) as {
            data?: { imageUrl?: string };
            imageUrl?: string;
          };
          imageUrl = response.data?.imageUrl || response.imageUrl || "";
        } catch {
          reject(new Error("Upload returned an invalid response."));
          return;
        }

        if (!imageUrl) {
          reject(new Error("Upload returned an invalid image URL."));
          return;
        }

        onProgress(100);
        resolve({ imageUrl });
      };

      request.open("POST", "/api/product-image-upload");
      request.send(formData);
    } catch (error) {
      reject(error);
    }
  });
}

async function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(new Error("Failed to read image file."));
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("Failed to read image file."));
        return;
      }

      resolve(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

async function recognizeProductFromPayload(input: {
  imageDataUrl?: string;
  imageUrl: string;
}) {
  const response = await fetch("/api/product-recognition", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const payload = (await response
    .json()
    .catch(() => ({ error: "Product recognition returned an invalid response." }))) as {
    error?: string;
    recognition?: ProductRecognitionResult;
    recognition_warning?: string | null;
  };

  if (!response.ok || !payload.recognition) {
    throw new Error(payload.error || "Product recognition failed.");
  }

  return {
    recognition: {
      ...payload.recognition,
      highlights: Array.isArray(payload.recognition.highlights)
        ? payload.recognition.highlights
        : [],
    },
    warning: payload.recognition_warning || null,
  };
}

async function parseJsonResponse<T>(response: Response, fallbackError: string) {
  return (await response.json().catch(() => ({ error: fallbackError }))) as T & {
    error?: string;
  };
}

function normalizePromptOutput(value: unknown): PromptEngineOutput {
  const record =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  const detailPageModules = Array.isArray(record.detailPageModules)
    ? record.detailPageModules
        .map((item, index) => {
          const moduleRecord =
            item && typeof item === "object"
              ? (item as Record<string, unknown>)
              : {};
          const id =
            typeof moduleRecord.id === "string"
              ? moduleRecord.id
              : `AD-${String(index + 1).padStart(2, "0")}`;

          return {
            description:
              typeof moduleRecord.description === "string"
                ? moduleRecord.description
                : "",
            id,
            imagePrompt:
              typeof moduleRecord.imagePrompt === "string"
                ? moduleRecord.imagePrompt
                : "",
            title:
              typeof moduleRecord.title === "string" ? moduleRecord.title : id,
          };
        })
        .filter((module) => module.imagePrompt.trim())
    : [];
  const mainImagePrompts = Array.isArray(record.mainImagePrompts)
    ? record.mainImagePrompts
        .map((item, index) => {
          const promptRecord =
            item && typeof item === "object"
              ? (item as Record<string, unknown>)
              : {};
          const id =
            typeof promptRecord.id === "string"
              ? promptRecord.id
              : `AS-${String(index + 1).padStart(2, "0")}`;

          return {
            id,
            prompt:
              typeof promptRecord.prompt === "string"
                ? promptRecord.prompt
                : "",
            title:
              typeof promptRecord.title === "string" ? promptRecord.title : id,
          };
        })
        .filter((prompt) => prompt.prompt.trim())
    : [];
  const listingImagePrompts = Array.isArray(record.listingImagePrompts)
    ? record.listingImagePrompts
        .map((item, index) => {
          const promptRecord =
            item && typeof item === "object"
              ? (item as Record<string, unknown>)
              : {};
          const fallbackRole =
            defaultListingImageRoles[index] || defaultListingImageRoles[1];
          const id =
            typeof promptRecord.id === "string"
              ? promptRecord.id
              : `AS-${String(index + 1).padStart(2, "0")}`;
          const role =
            typeof promptRecord.role === "string" &&
            defaultListingImageRoles
              .concat(listingImageRoleOptions.map((option) => option.value))
              .includes(promptRecord.role as ListingImageRole)
              ? (promptRecord.role as ListingImageRole)
              : fallbackRole;

          return {
            id,
            prompt:
              typeof promptRecord.prompt === "string"
                ? promptRecord.prompt
                : "",
            role,
            title:
              typeof promptRecord.title === "string" ? promptRecord.title : id,
          };
        })
        .filter((prompt) => prompt.prompt.trim())
    : [];

  return {
    detailPageModules,
    detailPagePrompt:
      typeof record.detailPagePrompt === "string" ? record.detailPagePrompt : "",
    infographicPrompt:
      typeof record.infographicPrompt === "string"
        ? record.infographicPrompt
        : "",
    lifestylePrompt:
      typeof record.lifestylePrompt === "string" ? record.lifestylePrompt : "",
    listingImagePrompts,
    mainImagePrompt:
      typeof record.mainImagePrompt === "string" ? record.mainImagePrompt : "",
    mainImagePrompts,
  };
}

async function generatePrompts(
  recognition: ProductRecognitionResult,
  platform: EcommercePlatform,
  options: {
    customRequirement: string;
    detailEndId: string;
    detailGenerationMode: DetailGenerationMode;
    detailStartId: string;
    generationMode: GenerationMode;
    listingImageCount: number;
    listingImageRoles: ListingImageRole[];
    mainImageCount: number;
    referenceImageNotes: string;
    referenceInfluence: number;
  },
) {
  const response = await fetch("/api/prompt-engine", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      platform,
      product_name: recognition.product_name,
      category: recognition.category,
      highlights: recognition.highlights,
      custom_requirement: options.customRequirement,
      detail_end_id: options.detailEndId,
      detail_generation_mode: options.detailGenerationMode,
      detail_start_id: options.detailStartId,
      generation_mode: options.generationMode,
      listing_image_count: options.listingImageCount,
      listing_image_roles: options.listingImageRoles,
      main_image_count: options.mainImageCount,
      reference_image_notes: options.referenceImageNotes,
      reference_influence: options.referenceInfluence,
    }),
  });
  const payload = await parseJsonResponse<{
    credit_balance?: number | null;
    prompts?: unknown;
  }>(response, "Prompt generation returned an invalid response.");

  if (!response.ok || !payload.prompts) {
    throw new Error(payload.error || "Prompt generation failed.");
  }

  return {
    creditBalance:
      typeof payload.credit_balance === "number" ? payload.credit_balance : null,
    prompts: normalizePromptOutput(payload.prompts),
  };
}

async function queueGeneratedImage(input: {
  imageType: GeneratedImageType;
  prompt: string;
  platform: EcommercePlatform;
  recognitionId?: string;
  moduleId?: string;
  styleReferenceImageUrl?: string;
  size?: GeneratedImageSize;
}) {
  const response = await fetch("/api/image-generation", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      image_type: input.imageType,
      prompt: input.prompt,
      platform: input.platform,
      recognition_id: input.recognitionId,
      module_id: input.moduleId,
      style_reference_image_url: input.styleReferenceImageUrl,
      size: input.size,
    }),
  });
  const payload = await parseJsonResponse<{
    credit_balance?: number | null;
    job?: GeneratedImageJob;
  }>(response, "Image generation queue returned an invalid response.");

  if (!response.ok || !payload.job) {
    throw new Error(payload.error || "Image generation queue failed.");
  }

  return {
    creditBalance:
      typeof payload.credit_balance === "number" ? payload.credit_balance : null,
    job: payload.job,
  };
}

async function processGeneratedImage(jobId: string) {
  const response = await fetch(`/api/image-generation/${jobId}/process`, {
    method: "POST",
  });
  const payload = await parseJsonResponse<{
    credit_balance?: number | null;
    job?: GeneratedImageJob;
  }>(response, "Image generation processing returned an invalid response.");

  if (!response.ok || !payload.job) {
    throw new Error(payload.error || "Image generation failed.");
  }

  return {
    creditBalance:
      typeof payload.credit_balance === "number" ? payload.credit_balance : null,
    job: payload.job,
  };
}

async function loadCreditBalance() {
  const response = await fetch("/api/credits");
  const payload = await parseJsonResponse<{
    credit_balance?: number;
  }>(response, "Failed to load credit balance.");

  if (!response.ok || typeof payload.credit_balance !== "number") {
    throw new Error(payload.error || "Failed to load credit balance.");
  }

  return payload.credit_balance;
}

async function refreshGeneratedImages(jobIds: string[]) {
  if (!jobIds.length) {
    return [];
  }

  const response = await fetch(`/api/image-generation?ids=${jobIds.join(",")}`);
  const payload = await parseJsonResponse<{
    jobs?: GeneratedImageJob[];
  }>(response, "Failed to refresh image jobs.");

  if (!response.ok || !payload.jobs) {
    throw new Error(payload.error || "Failed to refresh image jobs.");
  }

  return sortGeneratedImageJobs(payload.jobs);
}

function getDetailModuleId(job: GeneratedImageJob) {
  const moduleId = job.metadata?.module_id;

  return typeof moduleId === "string" ? moduleId : "";
}

function getDetailPageJobs(jobs: GeneratedImageJob[]) {
  return jobs
    .filter(
      (job) =>
        job.metadata?.image_type === "detail_page_module" &&
        job.status === "completed" &&
        Boolean(job.public_url),
    )
    .sort((a, b) => getDetailModuleId(a).localeCompare(getDetailModuleId(b)));
}

function getModuleIdIndex(moduleId: string) {
  return detailModuleIds.findIndex((id) => id === moduleId);
}

function getJobModuleId(job: GeneratedImageJob) {
  const moduleId = job.metadata?.module_id;

  return typeof moduleId === "string" ? moduleId : "";
}

function getModuleSortValue(job: GeneratedImageJob) {
  const moduleId = getJobModuleId(job);
  const match = moduleId.match(/^(AS|AD)-(\d{2})$/);

  if (match) {
    return `${match[1]}-${match[2]}`;
  }

  return moduleId || job.created_at || job.id;
}

function sortGeneratedImageJobs(jobs: GeneratedImageJob[]) {
  return [...jobs].sort((a, b) => {
    const aSort = getModuleSortValue(a);
    const bSort = getModuleSortValue(b);

    if (aSort !== bSort) {
      return aSort.localeCompare(bSort);
    }

    return a.created_at.localeCompare(b.created_at);
  });
}

function hasPendingGeneratedJobs(jobs: GeneratedImageJob[]) {
  return jobs.some(
    (job) => job.status === "queued" || job.status === "processing",
  );
}

function hasFailedGeneratedJobs(jobs: GeneratedImageJob[]) {
  return jobs.some((job) => job.status === "failed");
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

async function runWithConcurrency<TItem, TResult>(
  items: TItem[],
  limit: number,
  worker: (item: TItem, index: number) => Promise<TResult>,
) {
  const results: Array<PromiseSettledResult<TResult> | undefined> = Array.from({
    length: items.length,
  });
  let nextIndex = 0;
  const workerCount = Math.min(Math.max(limit, 1), items.length);

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < items.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;

        try {
          results[currentIndex] = {
            status: "fulfilled",
            value: await worker(items[currentIndex], currentIndex),
          };
        } catch (error) {
          results[currentIndex] = {
            reason: error,
            status: "rejected",
          };
        }
      }
    }),
  );

  return results as PromiseSettledResult<TResult>[];
}

function getSelectedDetailModules(
  modules: PromptEngineOutput["detailPageModules"],
  startId: string,
  endId: string,
) {
  const startIndex = Math.max(getModuleIdIndex(startId), 0);
  const endIndex = Math.max(getModuleIdIndex(endId), startIndex);
  const selectedIds = new Set<string>(
    detailModuleIds.slice(startIndex, endIndex + 1),
  );

  return modules.filter((module) => selectedIds.has(module.id));
}

function getVisiblePromptEntries(input: {
  detailGenerationMode: DetailGenerationMode;
  generationMode: GenerationMode;
  prompts: PromptEngineOutput;
}) {
  if (input.generationMode === "main") {
    const prompts = input.prompts.listingImagePrompts.length
      ? input.prompts.listingImagePrompts
      : input.prompts.mainImagePrompts.map((prompt) => ({
          ...prompt,
          role: "benefit" as ListingImageRole,
        }));

    return prompts.map((prompt) => ({
      id: prompt.id,
      prompt: prompt.prompt,
      title: prompt.title,
    }));
  }

  if (input.detailGenerationMode === "long") {
    return input.prompts.detailPagePrompt.trim()
      ? [
          {
            id: "9:32",
            prompt: input.prompts.detailPagePrompt,
            title: "详情页超长图",
          },
        ]
      : [];
  }

  return input.prompts.detailPageModules.map((module) => ({
    id: module.id,
    prompt: module.imagePrompt,
    title: module.title,
  }));
}

function buildMainImagePromptVariant(prompt: string, index: number, total: number) {
  return [
    prompt,
    `本次生成副图 AS-${String(index + 1).padStart(2, "0")} / ${total}。`,
    "保持 1:1 方图，商品完整清晰，围绕一个副图卖点做场景、信息或证明表达。",
    "同批多张副图之间只变化表达目的、版式、场景或证明方式，不改变商品结构、颜色、包装文字和真实比例。",
  ].join("\n\n");
}

function getMainImagePromptVariants(
  promptOutput: PromptEngineOutput,
  count: number,
) {
  const prompts = promptOutput.listingImagePrompts.length
    ? promptOutput.listingImagePrompts
    : promptOutput.mainImagePrompts.length
      ? promptOutput.mainImagePrompts
      : Array.from({ length: count }, (_, index) => ({
          id: `AS-${String(index + 1).padStart(2, "0")}`,
          prompt: buildMainImagePromptVariant(
            promptOutput.mainImagePrompt,
            index,
            count,
          ),
          title: `AS-${String(index + 1).padStart(2, "0")}`,
        }));

  return prompts.slice(0, count);
}

function getListingPromptForJob(
  promptOutput: PromptEngineOutput,
  job: GeneratedImageJob,
) {
  const moduleId = getJobModuleId(job);

  return promptOutput.listingImagePrompts.find(
    (prompt) => prompt.id === moduleId,
  );
}

function buildDetailImagePromptVariant(input: {
  aspectLabel: string;
  basePrompt: string;
}) {
  return [
    input.basePrompt,
    `用户选择的详情页比例：${input.aspectLabel}。`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

function buildLongDetailPagePrompt(promptOutput: PromptEngineOutput) {
  const modules = promptOutput.detailPageModules.length
    ? promptOutput.detailPageModules
    : detailModuleIds.map((id) => ({
        description: "围绕商品卖点设计一个完整详情页段落。",
        id,
        imagePrompt: "",
        title: id,
      }));

  return [
    promptOutput.detailPagePrompt,
    "任务：生成一张完整 9:32 电商详情页长图，不是单个 AD 模块，也不是多张模块拼接。",
    "画幅与结构：按 9:32 超长竖版详情页设计，顶部到尾部是一张完整页面。当前图像生成尺寸作为预览画布使用，但版式必须体现完整长详情页的信息流。",
    "Amazon A+/详情页规则：每一屏都有一个大观点、一个视觉事件、一个环境或细节层；模块之间节奏变化，避免连续居中商品图或重复标签。",
    "页面顺序：首屏价值主视觉 -> 痛点/解决方案 -> 核心卖点证明 -> 结构/细节特写 -> 使用场景 -> 规格/适配 -> FAQ/购买前确认。",
    "视觉要求：保留清晰标题区、短副标题和 1-4 个证明标签；文字集中成组，不覆盖商品关键结构；商品形态、颜色、比例、包装文字必须保持真实一致。",
    "负面约束：不要做成单张海报，不要只做拼贴缩略图，不要编造认证/参数/价格/促销，不要霓虹光效或大段不可读小字。",
    `参考 AD 信息：${modules
      .map((module) => `${module.id} ${module.title}：${module.description}`)
      .join("；")}`,
  ].join("\n\n");
}

async function loadImageForCanvas(url: string) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("Failed to load generated image for export.");
  }

  const blobUrl = URL.createObjectURL(await response.blob());

  try {
    const image = new window.Image();
    image.decoding = "async";
    image.src = blobUrl;

    await image.decode();
    return image;
  } catch (error) {
    URL.revokeObjectURL(blobUrl);
    throw error;
  }
}

async function buildDetailPageCanvas(jobs: GeneratedImageJob[]) {
  const images = await Promise.all(
    jobs.map((job) => loadImageForCanvas(job.public_url || "")),
  );
  const width = Math.max(...images.map((image) => image.naturalWidth));
  const height = images.reduce((total, image) => total + image.naturalHeight, 0);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Canvas is not available.");
  }

  canvas.width = width;
  canvas.height = height;
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);

  let offsetY = 0;
  images.forEach((image) => {
    const drawWidth = canvas.width;
    const drawHeight = Math.round(
      (image.naturalHeight / image.naturalWidth) * drawWidth,
    );

    if (offsetY < canvas.height) {
      context.drawImage(image, 0, offsetY, drawWidth, drawHeight);
    }

    offsetY += drawHeight;
    URL.revokeObjectURL(image.src);
  });

  return canvas;
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export function ImageUploader({
  isAuthenticated,
}: {
  isAuthenticated: boolean;
}) {
  const { dictionary } = useLanguage();
  const {
    clearGenerationDraft,
    clearProgress: clearBackgroundProgress,
    generationDraft: backgroundGenerationDraft,
    minimize: minimizeBackgroundGeneration,
    progress: backgroundGenerationProgress,
    updateGenerationDraft,
    updateProgress: updateBackgroundProgress,
  } = useBackgroundGeneration();
  const inputId = useId();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [status, setStatus] = useState<UploadState>("idle");
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState("");
  const [recognitionStatus, setRecognitionStatus] =
    useState<RecognitionState>("idle");
  const [promptStatus, setPromptStatus] = useState<PromptState>("idle");
  const [promptError, setPromptError] = useState("");
  const [selectedPlatform, setSelectedPlatform] =
    useState<EcommercePlatform>("taobao");
  const [generationMode, setGenerationMode] =
    useState<GenerationMode>("main");
  const [detailGenerationMode, setDetailGenerationMode] =
    useState<DetailGenerationMode>("modules");
  const [listingImageCount, setListingImageCount] = useState<number>(5);
  const [listingImageRoles, setListingImageRoles] = useState<ListingImageRole[]>(
    defaultListingImageRoles.slice(0, 5),
  );
  const [referenceImageNotes, setReferenceImageNotes] = useState("");
  const [referenceStyleImage, setReferenceStyleImage] =
    useState<ReferenceStyleImage | null>(null);
  const [referenceStyleUploadStatus, setReferenceStyleUploadStatus] =
    useState<UploadState>("idle");
  const [referenceStyleError, setReferenceStyleError] = useState("");
  const [referenceInfluence, setReferenceInfluence] = useState(30);
  const [customRequirement, setCustomRequirement] = useState("");
  const [detailStartId, setDetailStartId] = useState<string>("AD-01");
  const [detailEndId, setDetailEndId] = useState<string>("AD-06");
  const [detailAspect, setDetailAspect] =
    useState<(typeof detailAspectOptions)[number]["value"]>("wide");
  const [prompts, setPrompts] = useState<PromptEngineOutput | null>(null);
  const [imageQueueStatus, setImageQueueStatus] =
    useState<ImageQueueState>("idle");
  const [isGenerationPanelMinimized, setIsGenerationPanelMinimized] =
    useState(false);
  const [imageQueueError, setImageQueueError] = useState("");
  const [generatedImageJobs, setGeneratedImageJobs] = useState<
    GeneratedImageJob[]
  >([]);
  const [detailPageExportStatus, setDetailPageExportStatus] =
    useState<ExportState>("idle");
  const [detailPageExportError, setDetailPageExportError] = useState("");
  const [downloadFormat, setDownloadFormat] =
    useState<ImageDownloadFormat>("original");
  const [downloadError, setDownloadError] = useState("");
  const [downloadingImageId, setDownloadingImageId] = useState<string | null>(
    null,
  );
  const [isBatchDownloading, setIsBatchDownloading] = useState(false);
  const [previewImage, setPreviewImage] = useState<ImagePreviewState | null>(
    null,
  );
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const referenceStyleInputId = useId();
  const referenceStyleInputRef = useRef<HTMLInputElement>(null);
  const hasRestoredGenerationDraftRef = useRef(false);

  useEffect(() => {
    if (hasRestoredGenerationDraftRef.current) {
      return;
    }

    hasRestoredGenerationDraftRef.current = true;

    if (!backgroundGenerationDraft) {
      return;
    }

    const draft = backgroundGenerationDraft as ImageUploaderGenerationDraft;

    setPreviewUrl(draft.previewUrl || draft.result?.imageUrl || "");
    setStatus(draft.status || "idle");
    setProgress(draft.progress || 0);
    setResult(draft.result || null);
    setError(draft.error || "");
    setRecognitionStatus(draft.recognitionStatus || "idle");
    setPromptStatus(draft.promptStatus || "idle");
    setPromptError(draft.promptError || "");
    setSelectedPlatform(draft.selectedPlatform || "taobao");
    setGenerationMode(draft.generationMode || "main");
    setDetailGenerationMode(draft.detailGenerationMode || "modules");
    setListingImageCount(draft.listingImageCount || 5);
    setListingImageRoles(
      draft.listingImageRoles?.length
        ? draft.listingImageRoles
        : defaultListingImageRoles.slice(0, 5),
    );
    setReferenceImageNotes(draft.referenceImageNotes || "");
    setReferenceStyleImage(draft.referenceStyleImage || null);
    setReferenceStyleUploadStatus(draft.referenceStyleUploadStatus || "idle");
    setReferenceStyleError(draft.referenceStyleError || "");
    setReferenceInfluence(draft.referenceInfluence ?? 30);
    setCustomRequirement(draft.customRequirement || "");
    setDetailStartId(draft.detailStartId || "AD-01");
    setDetailEndId(draft.detailEndId || "AD-06");
    setDetailAspect(draft.detailAspect || "wide");
    setPrompts(draft.prompts || null);
    setImageQueueStatus(draft.imageQueueStatus || "idle");
    setIsGenerationPanelMinimized(draft.isGenerationPanelMinimized || false);
    setImageQueueError(draft.imageQueueError || "");
    setGeneratedImageJobs(draft.generatedImageJobs || []);
    setDetailPageExportStatus(draft.detailPageExportStatus || "idle");
    setDetailPageExportError(draft.detailPageExportError || "");
  }, [backgroundGenerationDraft]);

  useEffect(() => {
    if (!hasRestoredGenerationDraftRef.current) {
      return;
    }

    updateGenerationDraft({
      customRequirement,
      detailAspect,
      detailEndId,
      detailGenerationMode,
      detailPageExportError,
      detailPageExportStatus,
      detailStartId,
      error,
      generatedImageJobs,
      generationMode,
      imageQueueError,
      imageQueueStatus,
      isGenerationPanelMinimized,
      listingImageCount,
      listingImageRoles,
      previewUrl: previewUrl || result?.imageUrl || "",
      progress,
      promptError,
      promptStatus,
      prompts,
      recognitionStatus,
      referenceImageNotes,
      referenceInfluence,
      referenceStyleError,
      referenceStyleImage,
      referenceStyleUploadStatus,
      result,
      selectedPlatform,
      status,
    } satisfies ImageUploaderGenerationDraft);
  }, [
    customRequirement,
    detailAspect,
    detailEndId,
    detailGenerationMode,
    detailPageExportError,
    detailPageExportStatus,
    detailStartId,
    error,
    generatedImageJobs,
    generationMode,
    imageQueueError,
    imageQueueStatus,
    isGenerationPanelMinimized,
    listingImageCount,
    listingImageRoles,
    previewUrl,
    progress,
    promptError,
    promptStatus,
    prompts,
    recognitionStatus,
    referenceImageNotes,
    referenceInfluence,
    referenceStyleError,
    referenceStyleImage,
    referenceStyleUploadStatus,
    result,
    selectedPlatform,
    status,
    updateGenerationDraft,
  ]);

  useEffect(() => {
    void loadCreditBalance()
      .then(setCreditBalance)
      .catch(() => setCreditBalance(null));
  }, []);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(result?.imageUrl || "");
      return;
    }

    const nextPreviewUrl = URL.createObjectURL(file);
    setPreviewUrl(nextPreviewUrl);

    return () => {
      URL.revokeObjectURL(nextPreviewUrl);
    };
  }, [file, result?.imageUrl]);

  useEffect(() => {
    if (!generatedImageJobs.length && imageQueueStatus === "idle") {
      clearBackgroundProgress();
      return;
    }

    const completed = generatedImageJobs.filter(
      (job) => job.status === "completed",
    ).length;
    const failed = generatedImageJobs.filter(
      (job) => job.status === "failed",
    ).length;
    const total =
      generatedImageJobs.length ||
      (generationMode === "detail" ? 1 : listingImageCount);
    const activeJob = generatedImageJobs.find(
      (job) => job.status === "processing" || job.status === "queued",
    );

    updateBackgroundProgress({
      activeLabel: activeJob
        ? `${dictionary.common.processing}: ${
            getJobModuleId(activeJob) || dictionary.imageUploader.generating
          }`
        : imageQueueStatus === "success"
          ? dictionary.backgroundGeneration.completed
          : "",
      completed,
      failed,
      href: "/generate#generation-workspace",
      isMinimized: isGenerationPanelMinimized,
      label:
        generationMode === "detail"
          ? dictionary.imageUploader.detailPage
          : dictionary.imageUploader.listingImageSet,
      status: imageQueueStatus,
      total,
    });
  }, [
    clearBackgroundProgress,
    generatedImageJobs,
    generationMode,
    imageQueueStatus,
    isGenerationPanelMinimized,
    listingImageCount,
    dictionary,
    updateBackgroundProgress,
  ]);

  useEffect(() => {
    if (!backgroundGenerationProgress.isMinimized && isGenerationPanelMinimized) {
      setIsGenerationPanelMinimized(false);
    }
  }, [backgroundGenerationProgress.isMinimized, isGenerationPanelMinimized]);

  useEffect(() => {
    const shouldRefreshBackgroundJobs =
      generatedImageJobs.length > 0 &&
      (imageQueueStatus === "queueing" || imageQueueStatus === "processing") &&
      hasPendingGeneratedJobs(generatedImageJobs);

    if (!shouldRefreshBackgroundJobs) {
      return;
    }

    let isActive = true;
    let backgroundRefreshTimer: number | null = null;
    const activeJobIds = generatedImageJobs.map((job) => job.id);

    async function refreshBackgroundJobs() {
      try {
        const refreshedJobs = await refreshGeneratedImages(activeJobIds);

        if (!isActive) {
          return;
        }

        setGeneratedImageJobs(refreshedJobs);

        if (hasPendingGeneratedJobs(refreshedJobs)) {
          backgroundRefreshTimer = window.setTimeout(refreshBackgroundJobs, 3000);
          return;
        }

        if (hasFailedGeneratedJobs(refreshedJobs)) {
          setImageQueueStatus("error");
          setImageQueueError(dictionary.imageUploader.partialGenerationFailed);
        } else {
          setImageQueueStatus("success");
          setImageQueueError("");
        }

        void loadCreditBalance()
          .then(setCreditBalance)
          .catch(() => {});
      } catch {
        if (!isActive) {
          return;
        }

        backgroundRefreshTimer = window.setTimeout(refreshBackgroundJobs, 5000);
      }
    }

    void refreshBackgroundJobs();

    return () => {
      isActive = false;

      if (backgroundRefreshTimer) {
        window.clearTimeout(backgroundRefreshTimer);
      }
    };
  }, [dictionary, generatedImageJobs, imageQueueStatus]);

  useEffect(() => {
    if (!previewImage) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setPreviewImage(null);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [previewImage]);

  function openImagePreview(image: ImagePreviewState) {
    setPreviewImage(image);
  }

  function selectFile(nextFile?: File) {
    clearGenerationDraft();
    setResult(null);
    setProgress(0);
    setError("");
    setRecognitionStatus("idle");
    setPromptStatus("idle");
    setPromptError("");
    setPrompts(null);
    setImageQueueStatus("idle");
    setImageQueueError("");
    setGeneratedImageJobs([]);
    setDetailPageExportStatus("idle");
    setDetailPageExportError("");

    if (!nextFile) {
      setFile(null);
      setStatus("idle");
      return;
    }

    if (!isAllowedImage(nextFile)) {
      setFile(null);
      setStatus("error");
      setError(dictionary.imageUploader.invalidImage);
      return;
    }

    setFile(nextFile);
    setStatus("ready");
  }

  async function handleUpload() {
    if (!file || status === "uploading") {
      return;
    }

    if (!isAuthenticated) {
      setStatus("error");
      setError(dictionary.imageUploader.loginRequiredDescription);
      return;
    }

    setStatus("uploading");
    setRecognitionStatus("idle");
    setProgress(0);
    setError("");
    setResult(null);
    setPromptStatus("idle");
    setPromptError("");
    setPrompts(null);
    setImageQueueStatus("idle");
    setImageQueueError("");
    setGeneratedImageJobs([]);
    setDetailPageExportStatus("idle");
    setDetailPageExportError("");

    let uploadResult: UploadResult;

    try {
      uploadResult = await uploadToSupabaseStorage(file, setProgress);
    } catch (uploadError) {
      setStatus("error");
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : dictionary.imageUploader.uploadFailed,
      );
      return;
    }

    setResult(uploadResult);
    setStatus("success");
    setRecognitionStatus("recognizing");

    try {
      const imageDataUrl =
        file.size <= 3 * 1024 * 1024 ? await fileToDataUrl(file) : undefined;
      const recognitionResult = await recognizeProductFromPayload({
        imageDataUrl,
        imageUrl: uploadResult.imageUrl,
      });
      setResult({
        ...uploadResult,
        recognition: recognitionResult.recognition,
        recognitionWarning: recognitionResult.warning,
      });
      setRecognitionStatus("success");
    } catch (recognitionError) {
      setRecognitionStatus("error");
      setError(
        recognitionError instanceof Error
          ? recognitionError.message
          : dictionary.imageUploader.recognitionFailed,
      );
    }
  }

  function updateRecognitionField(
    field: "product_name" | "category" | "target_user",
    value: string,
  ) {
    setResult((currentResult) => {
      if (!currentResult?.recognition) {
        return currentResult;
      }

      return {
        ...currentResult,
        recognition: {
          ...currentResult.recognition,
          [field]: value,
        },
      };
    });
    setPrompts(null);
    setPromptStatus("idle");
    setPromptError("");
    setGeneratedImageJobs([]);
    setImageQueueStatus("idle");
    setImageQueueError("");
  }

  function updateRecognitionHighlight(index: number, value: string) {
    setResult((currentResult) => {
      if (!currentResult?.recognition) {
        return currentResult;
      }

      const highlights = [...currentResult.recognition.highlights];
      highlights[index] = value;

      return {
        ...currentResult,
        recognition: {
          ...currentResult.recognition,
          highlights,
        },
      };
    });
    setPrompts(null);
    setPromptStatus("idle");
    setPromptError("");
    setGeneratedImageJobs([]);
    setImageQueueStatus("idle");
    setImageQueueError("");
  }

  function addRecognitionHighlight() {
    setResult((currentResult) => {
      if (!currentResult?.recognition) {
        return currentResult;
      }

      return {
        ...currentResult,
        recognition: {
          ...currentResult.recognition,
          highlights: [...currentResult.recognition.highlights, ""],
        },
      };
    });
    setPrompts(null);
    setPromptStatus("idle");
    setPromptError("");
    setGeneratedImageJobs([]);
    setImageQueueStatus("idle");
    setImageQueueError("");
  }

  function removeRecognitionHighlight(index: number) {
    setResult((currentResult) => {
      if (!currentResult?.recognition) {
        return currentResult;
      }

      return {
        ...currentResult,
        recognition: {
          ...currentResult.recognition,
          highlights: currentResult.recognition.highlights.filter(
            (_highlight, highlightIndex) => highlightIndex !== index,
          ),
        },
      };
    });
    setPrompts(null);
    setPromptStatus("idle");
    setPromptError("");
    setGeneratedImageJobs([]);
    setImageQueueStatus("idle");
    setImageQueueError("");
  }

  function handleListingImageCountChange(count: number) {
    setListingImageCount(count);
    setListingImageRoles(
      Array.from(
        { length: count },
        (_item, index) =>
          listingImageRoles[index] ||
          defaultListingImageRoles[index] ||
          "benefit",
      ),
    );
    setPrompts(null);
    setPromptStatus("idle");
    setPromptError("");
    setGeneratedImageJobs([]);
    setImageQueueStatus("idle");
    setImageQueueError("");
  }

  function updateListingImageRole(index: number, role: ListingImageRole) {
    setListingImageRoles((currentRoles) => {
      const roles = [...currentRoles];
      roles[index] = role;
      return roles;
    });
    setPrompts(null);
    setPromptStatus("idle");
    setPromptError("");
    setGeneratedImageJobs([]);
    setImageQueueStatus("idle");
    setImageQueueError("");
  }

  function updateCustomRequirement(value: string) {
    setCustomRequirement(value);
    setGeneratedImageJobs([]);
    setImageQueueStatus("idle");
    setImageQueueError("");
  }

  async function handleReferenceStyleUpload(nextFile?: File) {
    setReferenceStyleError("");

    if (!nextFile) {
      return;
    }

    if (!isAllowedImage(nextFile)) {
      setReferenceStyleUploadStatus("error");
      setReferenceStyleError(dictionary.imageUploader.invalidImage);
      return;
    }

    if (!isAuthenticated) {
      setReferenceStyleUploadStatus("error");
      setReferenceStyleError(dictionary.imageUploader.loginRequiredDescription);
      return;
    }

    setReferenceStyleUploadStatus("uploading");

    try {
      const uploadResult = await uploadToSupabaseStorage(nextFile, () => {});
      const notes = `参考风格图已上传：${nextFile.name}；图片地址：${uploadResult.imageUrl}。只参考构图、色调、字体标注、版式节奏和背景氛围。`;

      setReferenceStyleImage({
        fileName: nextFile.name,
        imageUrl: uploadResult.imageUrl,
      });
      setReferenceImageNotes(notes);
      setReferenceStyleUploadStatus("success");
      setPrompts(null);
      setPromptStatus("idle");
      setPromptError("");
      setGeneratedImageJobs([]);
      setImageQueueStatus("idle");
      setImageQueueError("");
    } catch (uploadError) {
      setReferenceStyleUploadStatus("error");
      setReferenceStyleError(
        uploadError instanceof Error
          ? uploadError.message
          : dictionary.imageUploader.uploadFailed,
      );
    }
  }

  function removeReferenceStyleImage() {
    setReferenceStyleImage(null);
    setReferenceImageNotes("");
    setReferenceStyleUploadStatus("idle");
    setReferenceStyleError("");
    setPrompts(null);
    setPromptStatus("idle");
    setPromptError("");
    setGeneratedImageJobs([]);
    setImageQueueStatus("idle");
    setImageQueueError("");

    if (referenceStyleInputRef.current) {
      referenceStyleInputRef.current.value = "";
    }
  }

  function updateReferenceInfluence(value: number) {
    setReferenceInfluence(value);
    setPrompts(null);
    setPromptStatus("idle");
    setPromptError("");
    setGeneratedImageJobs([]);
    setImageQueueStatus("idle");
    setImageQueueError("");
  }

  async function handlePromptGeneration(
    recognition: ProductRecognitionResult,
    platform: EcommercePlatform,
  ) {
    setPromptStatus("generating");
    setPromptError("");
    setPrompts(null);

    try {
      const result = await generatePrompts(recognition, platform, {
        customRequirement,
        detailEndId,
        detailGenerationMode,
        detailStartId,
        generationMode,
        listingImageCount,
        listingImageRoles,
        mainImageCount: listingImageCount,
        referenceImageNotes,
        referenceInfluence,
      });
      setPrompts(result.prompts);
      if (result.creditBalance !== null) {
        setCreditBalance(result.creditBalance);
      }
      setPromptStatus("success");
    } catch (promptGenerationError) {
      setPromptStatus("error");
      setPromptError(
        promptGenerationError instanceof Error
          ? promptGenerationError.message
          : dictionary.imageUploader.promptGenerationFailed,
      );
    }
  }

  function handlePlatformChange(platform: EcommercePlatform) {
    setSelectedPlatform(platform);
    setImageQueueStatus("idle");
    setImageQueueError("");
    setPromptStatus("idle");
    setPromptError("");
    setPrompts(null);
    setGeneratedImageJobs([]);
    setDetailPageExportStatus("idle");
    setDetailPageExportError("");
  }

  function upsertGeneratedImageJob(nextJob: GeneratedImageJob) {
    setGeneratedImageJobs((currentJobs) => {
      const existingIndex = currentJobs.findIndex(
        (currentJob) => currentJob.id === nextJob.id,
      );

      if (existingIndex === -1) {
        return sortGeneratedImageJobs([...currentJobs, nextJob]);
      }

      const nextJobs = [...currentJobs];
      nextJobs[existingIndex] = nextJob;
      return sortGeneratedImageJobs(nextJobs);
    });
  }

  function upsertListingImageJob(nextJob: GeneratedImageJob) {
    setGeneratedImageJobs((currentJobs) => {
      const nextModuleId = getJobModuleId(nextJob);
      const existingIndex = currentJobs.findIndex(
        (currentJob) => getJobModuleId(currentJob) === nextModuleId,
      );

      if (!nextModuleId || existingIndex === -1) {
        return sortGeneratedImageJobs([...currentJobs, nextJob]);
      }

      const nextJobs = [...currentJobs];
      nextJobs[existingIndex] = nextJob;
      return sortGeneratedImageJobs(nextJobs);
    });
  }

  async function processQueuedImageJobWithRetry(job: GeneratedImageJob) {
    let activeJob = job;
    upsertGeneratedImageJob({ ...activeJob, status: "processing" });

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const processed = await processGeneratedImage(activeJob.id);

        if (processed.creditBalance !== null) {
          setCreditBalance(processed.creditBalance);
        }

        upsertGeneratedImageJob(processed.job);
        return processed.job;
      } catch (processError) {
        const refreshedJobs = await refreshGeneratedImages([activeJob.id]).catch(
          () => [],
        );
        const refreshedJob = refreshedJobs[0];

        if (refreshedJob) {
          upsertGeneratedImageJob(refreshedJob);
        }

        if (attempt < 2) {
          const imageType = activeJob.metadata?.image_type;
          const generationParams = activeJob.generation_params || {};
          const moduleId = getJobModuleId(activeJob);
          const recognitionId = activeJob.metadata?.product_recognition_id;
          const replacement = await queueGeneratedImage({
            imageType: isGeneratedImageType(imageType)
              ? imageType
              : "main_image",
            moduleId,
            platform: isEcommercePlatformValue(activeJob.metadata?.platform)
              ? activeJob.metadata.platform
              : selectedPlatform,
            prompt: activeJob.prompt,
            recognitionId:
              typeof recognitionId === "string"
                ? recognitionId
                : result?.recognition?.id,
            styleReferenceImageUrl:
              typeof activeJob.metadata?.style_reference_image_url === "string"
                ? activeJob.metadata.style_reference_image_url
                : referenceStyleImage?.imageUrl,
            size: isGeneratedImageSize(generationParams.size)
              ? generationParams.size
              : "1024x1024",
          });

          if (replacement.creditBalance !== null) {
            setCreditBalance(replacement.creditBalance);
          }

          activeJob = replacement.job;
          upsertGeneratedImageJob({ ...activeJob, status: "processing" });
          await sleep(1200);
          continue;
        }

        throw processError;
      }
    }

    return activeJob;
  }

  async function handleRegenerateListingImage(job: GeneratedImageJob) {
    if (!prompts || imageQueueStatus === "queueing") {
      return;
    }

    const prompt = getListingPromptForJob(normalizePromptOutput(prompts), job);

    if (!prompt) {
      setImageQueueError(dictionary.imageUploader.promptMissingForImage);
      return;
    }

    setImageQueueStatus("processing");
    setImageQueueError("");

    try {
      const queued = await queueGeneratedImage({
        imageType: "main_image",
        moduleId: prompt.id,
        platform: selectedPlatform,
        prompt: prompt.prompt,
        recognitionId: result?.recognition?.id,
        styleReferenceImageUrl: referenceStyleImage?.imageUrl,
        size: "1024x1024",
      });

      if (queued.creditBalance !== null) {
        setCreditBalance(queued.creditBalance);
      }

      upsertListingImageJob({ ...queued.job, status: "processing" });
      const processedJob = await processQueuedImageJobWithRetry(queued.job);
      upsertListingImageJob(processedJob);
      setImageQueueStatus("success");
    } catch (generationError) {
      setImageQueueStatus("error");
      setImageQueueError(
        generationError instanceof Error
          ? generationError.message
          : dictionary.imageUploader.imageGenerationFailed,
      );

      setCreditBalance(await loadCreditBalance().catch(() => creditBalance));
    }
  }

  async function handleGenerateMainImages() {
    if (!prompts || imageQueueStatus === "queueing") {
      return;
    }

    setImageQueueStatus("queueing");
    setIsGenerationPanelMinimized(false);
    setImageQueueError("");
    setGeneratedImageJobs([]);

    let queuedJobs: GeneratedImageJob[] = [];

    try {
      const mainImagePrompts = getMainImagePromptVariants(
        normalizePromptOutput(prompts),
        listingImageCount,
      );
      const queuedResults = await Promise.all(
        mainImagePrompts.map((mainPrompt, index) =>
          queueGeneratedImage({
            imageType: "main_image",
            prompt: mainPrompt.prompt,
            platform: selectedPlatform,
            recognitionId: result?.recognition?.id,
            moduleId:
              mainPrompt.id || `AS-${String(index + 1).padStart(2, "0")}`,
            styleReferenceImageUrl: referenceStyleImage?.imageUrl,
            size: "1024x1024",
          }),
        ),
      );
      queuedJobs = queuedResults.map((result) => result.job);
      const latestBalance = queuedResults.findLast(
        (result) => result.creditBalance !== null,
      )?.creditBalance;

      if (typeof latestBalance === "number") {
        setCreditBalance(latestBalance);
      }

      setGeneratedImageJobs(sortGeneratedImageJobs(queuedJobs));
      setImageQueueStatus("processing");

      const processedResults = await runWithConcurrency(
        queuedJobs,
        2,
        async (job) => processQueuedImageJobWithRetry(job),
      );
      const failedCount = processedResults.filter(
        (result) => result.status === "rejected",
      ).length;

      if (failedCount) {
        setImageQueueStatus("error");
        setImageQueueError(
          dictionary.imageUploader.listingGenerationFailed(failedCount),
        );
      } else {
        setImageQueueStatus("success");
      }
    } catch (generationError) {
      setImageQueueStatus("error");
      setImageQueueError(
        generationError instanceof Error
          ? generationError.message
          : dictionary.imageUploader.imageGenerationFailed,
      );

      try {
        const ids = queuedJobs.map((job) => job.id);
        const refreshedJobs = await refreshGeneratedImages(ids);
        setGeneratedImageJobs(sortGeneratedImageJobs(refreshedJobs));
        setCreditBalance(await loadCreditBalance());
      } catch {
        // Keep the current local queue when refresh fails.
      }
    }
  }

  async function handleGenerateDetailPage() {
    const normalized = normalizePromptOutput(prompts);
    const isLongDetailPage = detailGenerationMode === "long";
    const detailModules = getSelectedDetailModules(
      normalized.detailPageModules,
      detailStartId,
      detailEndId,
    );
    const aspectOption =
      detailAspectOptions.find((option) => option.value === detailAspect) ||
      detailAspectOptions[0];

    if (
      (!isLongDetailPage && !detailModules.length) ||
      imageQueueStatus === "queueing"
    ) {
      return;
    }

    setImageQueueStatus("queueing");
    setIsGenerationPanelMinimized(false);
    setImageQueueError("");
    setDetailPageExportStatus("idle");
    setDetailPageExportError("");
    setGeneratedImageJobs([]);

    let queuedJobs: GeneratedImageJob[] = [];

    try {
      const queuedResults = isLongDetailPage
        ? [
            await queueGeneratedImage({
              imageType: "detail_page_long",
              prompt: buildLongDetailPagePrompt(normalized),
              platform: selectedPlatform,
              recognitionId: result?.recognition?.id,
              moduleId: "AD-LONG",
              styleReferenceImageUrl: referenceStyleImage?.imageUrl,
              size: "1024x1536",
            }),
          ]
        : await Promise.all(
            detailModules.map((module) =>
              queueGeneratedImage({
                imageType: "detail_page_module",
                prompt: buildDetailImagePromptVariant({
                  aspectLabel: aspectOption.label,
                  basePrompt: module.imagePrompt,
                }),
                platform: selectedPlatform,
                recognitionId: result?.recognition?.id,
                moduleId: module.id,
                styleReferenceImageUrl: referenceStyleImage?.imageUrl,
                size: aspectOption.size,
              }),
            ),
          );
      queuedJobs = queuedResults.map((result) => result.job);
      const latestBalance = queuedResults.findLast(
        (result) => result.creditBalance !== null,
      )?.creditBalance;

      if (typeof latestBalance === "number") {
        setCreditBalance(latestBalance);
      }

      setGeneratedImageJobs(queuedJobs);
      setImageQueueStatus("processing");

      const processedResults = await runWithConcurrency(
        queuedJobs,
        2,
        async (job) => {
          upsertGeneratedImageJob({ ...job, status: "processing" });
          const processed = await processGeneratedImage(job.id);

          if (processed.creditBalance !== null) {
            setCreditBalance(processed.creditBalance);
          }

          upsertGeneratedImageJob(processed.job);
          return processed.job;
        },
      );

      const failedCount = processedResults.filter(
        (result) => result.status === "rejected",
      ).length;

      if (failedCount) {
        setImageQueueStatus("error");
        setImageQueueError(
          dictionary.imageUploader.detailGenerationFailed(failedCount),
        );
      } else {
        setImageQueueStatus("success");
      }
    } catch (generationError) {
      setImageQueueStatus("error");
      setImageQueueError(
        generationError instanceof Error
          ? generationError.message
          : dictionary.imageUploader.detailPageExportFailed,
      );

      try {
        const ids = queuedJobs.map((job) => job.id);
        const refreshedJobs = await refreshGeneratedImages(ids);
        setGeneratedImageJobs(refreshedJobs);
        setCreditBalance(await loadCreditBalance());
      } catch {
        // Keep the current local queue when refresh fails.
      }
    }
  }

  async function handleDownloadDetailPage(format: "png" | "pdf") {
    const detailPageJobs = getDetailPageJobs(generatedImageJobs);

    if (!detailPageJobs.length) {
      return;
    }

    setDetailPageExportStatus("exporting");
    setDetailPageExportError("");

    try {
      const canvas = await buildDetailPageCanvas(detailPageJobs);
      const productName =
        result?.recognition?.product_name
          .trim()
          .replace(/[\\/:*?"<>|]+/g, "-")
          .slice(0, 48) || "detail-page";

      if (format === "png") {
        canvas.toBlob((blob) => {
          if (!blob) {
            setDetailPageExportStatus("error");
            setDetailPageExportError(dictionary.imageUploader.exportPngFailed);
            return;
          }

          downloadBlob(blob, `${productName}-detail-page.png`);
          setDetailPageExportStatus("idle");
        }, "image/png");
        return;
      }

      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "px",
        format: [canvas.width, canvas.height],
        compress: true,
      });

      pdf.addImage(
        canvas.toDataURL("image/png"),
        "PNG",
        0,
        0,
        canvas.width,
        canvas.height,
      );
      pdf.save(`${productName}-detail-page.pdf`);
      setDetailPageExportStatus("idle");
    } catch (exportError) {
      setDetailPageExportStatus("error");
      setDetailPageExportError(
        exportError instanceof Error
          ? exportError.message
          : dictionary.imageUploader.detailPageExportFailed,
      );
    }
  }

  function getDownloadableGeneratedImages() {
    return generatedImageJobs
      .filter((job) => job.status === "completed" && Boolean(job.public_url))
      .map(
        (job) =>
          ({
            fileName: getGeneratedImageLabel(job),
            url: job.public_url || "",
          }) satisfies DownloadableImage,
      );
  }

  async function handleDownloadGeneratedImage(job: GeneratedImageJob) {
    if (!job.public_url) {
      return;
    }

    setDownloadError("");
    setDownloadingImageId(job.id);

    try {
      await downloadImageAsset(
        {
          fileName: getGeneratedImageLabel(job),
          url: job.public_url,
        },
        downloadFormat,
      );
    } catch (downloadFailure) {
      setDownloadError(
        downloadFailure instanceof Error
          ? downloadFailure.message
          : dictionary.dashboard.downloadFailed,
      );
    } finally {
      setDownloadingImageId(null);
    }
  }

  async function handleBatchDownloadGeneratedImages() {
    const images = getDownloadableGeneratedImages();

    if (!images.length) {
      return;
    }

    setDownloadError("");
    setIsBatchDownloading(true);

    try {
      await downloadImageBatch({
        archiveName: result?.recognition?.product_name || "generated-images",
        format: downloadFormat,
        images,
      });
    } catch (downloadFailure) {
      setDownloadError(
        downloadFailure instanceof Error
          ? downloadFailure.message
          : dictionary.dashboard.batchDownloadFailed,
      );
    } finally {
      setIsBatchDownloading(false);
    }
  }

  function updatePromptEntryPrompt(entryId: string, nextPrompt: string) {
    setPrompts((currentPrompts) => {
      if (!currentPrompts) {
        return currentPrompts;
      }

      const normalized = normalizePromptOutput(currentPrompts);

      if (generationMode === "main") {
        return {
          ...normalized,
          listingImagePrompts: normalized.listingImagePrompts.map((prompt) =>
            prompt.id === entryId ? { ...prompt, prompt: nextPrompt } : prompt,
          ),
          mainImagePrompts: normalized.mainImagePrompts.map((prompt) =>
            prompt.id === entryId ? { ...prompt, prompt: nextPrompt } : prompt,
          ),
          mainImagePrompt:
            normalized.listingImagePrompts[0]?.id === entryId
              ? nextPrompt
              : normalized.mainImagePrompt,
        };
      }

      if (detailGenerationMode === "long" && entryId === "9:32") {
        return {
          ...normalized,
          detailPagePrompt: nextPrompt,
        };
      }

      return {
        ...normalized,
        detailPageModules: normalized.detailPageModules.map((module) =>
          module.id === entryId ? { ...module, imagePrompt: nextPrompt } : module,
        ),
      };
    });
    setGeneratedImageJobs([]);
    setImageQueueStatus("idle");
    setImageQueueError("");
  }

  function getGeneratedImageLabel(job: GeneratedImageJob) {
    const imageType = job.metadata?.image_type;

    return typeof imageType === "string" && imageType in dictionary.common.imageTypes
      ? `${dictionary.common.imageTypes[imageType as GeneratedImageType]} ${
          getDetailModuleId(job) || ""
        }`.trim()
      : dictionary.imageUploader.generatedImageFallback;
  }

  const normalizedPrompts = prompts
    ? normalizePromptOutput(prompts)
    : emptyPromptOutput;
  const visiblePromptEntries = getVisiblePromptEntries({
    detailGenerationMode,
    generationMode,
    prompts: normalizedPrompts,
  });
  const detailPageModules = getSelectedDetailModules(
    normalizedPrompts.detailPageModules,
    detailStartId,
    detailEndId,
  );
  const detailPageJobs = getDetailPageJobs(generatedImageJobs);
  const canDownloadDetailPage =
    Boolean(detailPageModules.length) &&
    detailPageJobs.length === detailPageModules.length;
  const mainImageCreditCost =
    listingImageCount * imageGenerationCreditCosts.main_image;
  const detailPageCreditCost =
    detailGenerationMode === "long"
      ? imageGenerationCreditCosts.detail_page_long
      : detailPageModules.length * imageGenerationCreditCosts.detail_page_module;
  const canAffordMainImages =
    creditBalance === null || creditBalance >= mainImageCreditCost;
  const canAffordDetailPage =
    creditBalance === null || creditBalance >= detailPageCreditCost;
  const canAffordPromptGeneration =
    creditBalance === null || creditBalance >= promptGenerationCreditCost;
  const isMainMode = generationMode === "main";
  const isDetailMode = generationMode === "detail";
  const isLongDetailMode = detailGenerationMode === "long";
  const canMinimizeGenerationPanel =
    generatedImageJobs.length > 0 &&
    (imageQueueStatus === "queueing" ||
      imageQueueStatus === "processing" ||
      imageQueueStatus === "error");
  const downloadableGeneratedImageCount = generatedImageJobs.filter(
    (job) => job.status === "completed" && Boolean(job.public_url),
  ).length;

  return (
    <div className="space-y-5" id="generation-workspace">
      <div className="rounded-lg border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-medium">
              {dictionary.imageUploader.generationSettings}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {dictionary.imageUploader.generationSettingsDescription}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              className={cn(
                isMainMode && "border-primary bg-secondary",
              )}
              onClick={() => setGenerationMode("main")}
              type="button"
              variant={isMainMode ? "default" : "outline"}
            >
              {dictionary.imageUploader.generationModeMain}
            </Button>
            <Button
              className={cn(
                isDetailMode && "border-primary bg-secondary",
              )}
              onClick={() => setGenerationMode("detail")}
              type="button"
              variant={isDetailMode ? "default" : "outline"}
            >
              {dictionary.imageUploader.generationModeDetail}
            </Button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {isMainMode ? (
          <div className="rounded-md border p-3 lg:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-medium">
                  {dictionary.imageUploader.listingImageSet}
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {dictionary.imageUploader.listingImageSetDescription}
                </p>
              </div>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                {dictionary.imageUploader.listingImageCount}
                  <select
                    className="h-8 rounded-md border bg-background px-2 text-sm text-foreground"
                    onChange={(event) =>
                      handleListingImageCountChange(Number(event.target.value))
                    }
                    value={listingImageCount}
                  >
                  {listingImageCountOptions.map((count) => (
                    <option key={count} value={count}>
                      {count}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {Array.from({ length: listingImageCount }, (_item, index) => {
                const slotId = `AS-${String(index + 1).padStart(2, "0")}`;

                return (
                  <label
                    className="flex items-center justify-between gap-3 rounded-md bg-secondary p-2 text-xs text-muted-foreground"
                    key={slotId}
                  >
                    <span className="font-medium text-foreground">
                      {slotId}
                    </span>
                    <select
                      className="h-8 min-w-0 rounded-md border bg-background px-2 text-sm text-foreground"
                      onChange={(event) =>
                        updateListingImageRole(
                          index,
                          event.target.value as ListingImageRole,
                        )
                      }
                      value={
                        listingImageRoles[index] ||
                        defaultListingImageRoles[index] ||
                        "benefit"
                      }
                    >
                      {listingImageRoleOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {dictionary.imageUploader.roleLabels[option.value]}
                        </option>
                      ))}
                    </select>
                  </label>
                );
              })}
            </div>
            <div className="mt-4 grid gap-3">
              <label className="grid gap-1 text-xs text-muted-foreground">
                {dictionary.imageUploader.referenceInfluence(referenceInfluence)}
                <input
                  className="w-full"
                  max={80}
                  min={0}
                  onChange={(event) =>
                    updateReferenceInfluence(Number(event.target.value))
                  }
                  step={5}
                  type="range"
                  value={referenceInfluence}
                />
              </label>
              <div className="grid gap-2 text-xs text-muted-foreground">
                <span>{dictionary.imageUploader.referenceStyle}</span>
                <input
                  accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                  className="sr-only"
                  id={referenceStyleInputId}
                  onChange={(event) =>
                    void handleReferenceStyleUpload(event.target.files?.[0])
                  }
                  ref={referenceStyleInputRef}
                  type="file"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Button asChild size="sm" variant="outline">
                    <label htmlFor={referenceStyleInputId}>
                      {dictionary.imageUploader.uploadReference}
                    </label>
                  </Button>
                  {referenceStyleUploadStatus === "uploading" ? (
                    <span className="inline-flex items-center gap-1 text-foreground">
                      <Loader2 aria-hidden="true" className="size-3 animate-spin" />
                      {dictionary.imageUploader.uploading}
                    </span>
                  ) : null}
                  {referenceStyleImage ? (
                    <>
                      <span className="truncate text-foreground">
                        {referenceStyleImage.fileName}
                      </span>
                      <Button
                        onClick={removeReferenceStyleImage}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        {dictionary.imageUploader.remove}
                      </Button>
                    </>
                  ) : (
                    <span>{dictionary.imageUploader.referenceStyleFallback}</span>
                  )}
                </div>
                {referenceStyleError ? (
                  <p className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-destructive">
                    {referenceStyleError}
                  </p>
                ) : null}
              </div>
              <label className="grid gap-1 text-xs text-muted-foreground">
                {dictionary.imageUploader.requirement}
                <input
                  className="h-9 rounded-md border bg-background px-3 text-sm text-foreground"
                  onChange={(event) => updateCustomRequirement(event.target.value)}
                  placeholder={dictionary.imageUploader.requirementPlaceholder}
                  value={customRequirement}
                />
              </label>
            </div>
          </div>
          ) : null}

          {isDetailMode ? (
          <div className="rounded-md border p-3 lg:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-medium">
                  {dictionary.imageUploader.detailPage}
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {dictionary.imageUploader.detailPageOptionsDescription}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => setDetailGenerationMode("modules")}
                  size="sm"
                  type="button"
                  variant={detailGenerationMode === "modules" ? "default" : "outline"}
                >
                  {dictionary.imageUploader.detailGenerationModeModules}
                </Button>
                <Button
                  onClick={() => setDetailGenerationMode("long")}
                  size="sm"
                  type="button"
                  variant={detailGenerationMode === "long" ? "default" : "outline"}
                >
                  {dictionary.imageUploader.detailGenerationModeLong}
                </Button>
              </div>
            </div>

            {detailGenerationMode === "modules" ? (
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  {dictionary.imageUploader.detailRangeFrom}
                  <select
                    className="h-8 rounded-md border bg-background px-2 text-sm text-foreground"
                    onChange={(event) => {
                      const nextStart = event.target.value;
                      setDetailStartId(nextStart);
                      if (
                        getModuleIdIndex(nextStart) >
                        getModuleIdIndex(detailEndId)
                      ) {
                        setDetailEndId(nextStart);
                      }
                    }}
                    value={detailStartId}
                  >
                    {detailModuleIds.map((id) => (
                      <option key={id} value={id}>
                        {id}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  {dictionary.imageUploader.detailRangeTo}
                  <select
                    className="h-8 rounded-md border bg-background px-2 text-sm text-foreground"
                    onChange={(event) => {
                      const nextEnd = event.target.value;
                      setDetailEndId(nextEnd);
                      if (
                        getModuleIdIndex(nextEnd) < getModuleIdIndex(detailStartId)
                      ) {
                        setDetailStartId(nextEnd);
                      }
                    }}
                    value={detailEndId}
                  >
                    {detailModuleIds.map((id) => (
                      <option key={id} value={id}>
                        {id}
                      </option>
                    ))}
                  </select>
                </label>
                <select
                  className="h-8 rounded-md border bg-background px-2 text-sm"
                  onChange={(event) =>
                    setDetailAspect(event.target.value as typeof detailAspect)
                  }
                  value={detailAspect}
                >
                  {detailAspectOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {dictionary.imageUploader.aspectLabels[option.value]}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <p className="mt-3 rounded-md bg-secondary p-3 text-xs leading-5 text-muted-foreground">
                {dictionary.imageUploader.detailPageLongDescription}
              </p>
            )}
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,380px)]">
      <div
        className={cn(
          "flex min-h-[320px] flex-col items-center justify-center rounded-lg border border-dashed bg-card p-6 text-center transition-colors",
          isDragging && "border-primary bg-accent",
        )}
        onDragEnter={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setIsDragging(false);
        }}
        onDragOver={(event) => {
          event.preventDefault();
        }}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          selectFile(event.dataTransfer.files[0]);
        }}
      >
        {previewUrl ? (
          <Image
            alt={dictionary.imageUploader.selectedPreviewAlt}
            className="max-h-[280px] w-full rounded-md object-contain"
            height={280}
            src={previewUrl}
            unoptimized
            width={720}
          />
        ) : (
          <div className="flex max-w-sm flex-col items-center gap-4">
            <div className="flex size-14 items-center justify-center rounded-full bg-secondary">
              <ImagePlus aria-hidden="true" className="size-6" />
            </div>
            <div>
              <h2 className="text-lg font-medium">
                {dictionary.imageUploader.upload}
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {dictionary.imageUploader.uploadDescription}
              </p>
            </div>
          </div>
        )}
        <input
          accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
          className="sr-only"
          id={inputId}
          onChange={(event) => selectFile(event.target.files?.[0])}
          ref={inputRef}
          type="file"
        />
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button asChild variant="outline">
            <label htmlFor={inputId}>{dictionary.imageUploader.chooseFile}</label>
          </Button>
          <Button
            disabled={!file || status === "uploading" || !isAuthenticated}
            onClick={handleUpload}
            type="button"
          >
            {status === "uploading" ? (
              <Loader2 aria-hidden="true" className="animate-spin" />
            ) : recognitionStatus === "recognizing" ? (
              <ScanSearch aria-hidden="true" />
            ) : (
              <Upload aria-hidden="true" />
            )}
            {status === "uploading"
              ? dictionary.imageUploader.uploading
              : recognitionStatus === "recognizing"
                ? dictionary.imageUploader.recognizing
                : dictionary.imageUploader.uploadAndRecognize}
          </Button>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-medium">
              {dictionary.imageUploader.uploadStatus}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              jpg, jpeg, png, webp
            </p>
          </div>
          {status === "success" ? (
            <CheckCircle2 aria-hidden="true" className="size-5 text-green-600" />
          ) : status === "error" ? (
            <XCircle aria-hidden="true" className="size-5 text-destructive" />
          ) : null}
        </div>

        {!isAuthenticated ? (
          <div className="mt-5 rounded-md border border-destructive/30 bg-destructive/10 p-3">
            <p className="text-sm font-medium text-destructive">
              {dictionary.imageUploader.loginRequired}
            </p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {dictionary.imageUploader.loginRequiredDescription}
            </p>
            <Button asChild className="mt-3" size="sm" variant="outline">
              <Link href="/login">{dictionary.account.login}</Link>
            </Button>
          </div>
        ) : null}

        {file ? (
          <div className="mt-5 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">
                {dictionary.imageUploader.file}
              </span>
              <span className="truncate text-right font-medium">{file.name}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">
                {dictionary.imageUploader.size}
              </span>
              <span className="font-medium">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </span>
            </div>
          </div>
        ) : null}

        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {dictionary.imageUploader.progress}
            </span>
            <span className="font-medium">{progress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {recognitionStatus === "recognizing" ? (
          <div className="mt-4 flex items-center gap-2 rounded-md border bg-secondary p-3 text-sm">
            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            {dictionary.imageUploader.recognizingDetails}
          </div>
        ) : null}

        {error ? (
          <p className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        {result ? (
          <div className="mt-4 space-y-4">
            {result.recognition ? (
              <>
                {result.recognitionWarning ? (
                  <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm leading-6 text-amber-800">
                    {result.recognitionWarning}
                  </p>
                ) : null}
                <div className="space-y-3 rounded-md bg-secondary p-3 text-sm">
                  <div>
                    <label className="text-xs text-muted-foreground">
                      {dictionary.imageUploader.product}
                    </label>
                    <input
                      className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm"
                      onChange={(event) =>
                        updateRecognitionField(
                          "product_name",
                          event.target.value,
                        )
                      }
                      placeholder={dictionary.common.unknown}
                      value={result.recognition.product_name}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">
                      {dictionary.imageUploader.category}
                    </label>
                    <input
                      className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm"
                      onChange={(event) =>
                        updateRecognitionField("category", event.target.value)
                      }
                      placeholder={dictionary.common.unknown}
                      value={result.recognition.category}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">
                      {dictionary.imageUploader.targetUser}
                    </label>
                    <input
                      className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm"
                      onChange={(event) =>
                        updateRecognitionField(
                          "target_user",
                          event.target.value,
                        )
                      }
                      placeholder={dictionary.common.unknown}
                      value={result.recognition.target_user}
                    />
                  </div>
                  <div>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <span className="text-xs text-muted-foreground">
                        {dictionary.imageUploader.highlights}
                      </span>
                      <Button
                        onClick={addRecognitionHighlight}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        {dictionary.imageUploader.add}
                      </Button>
                    </div>
                    <div className="grid gap-2">
                      {result.recognition.highlights.map((highlight, index) => (
                        <div className="flex items-center gap-2" key={index}>
                          <input
                            className="h-9 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm"
                            onChange={(event) =>
                              updateRecognitionHighlight(
                                index,
                                event.target.value,
                              )
                            }
                            placeholder={dictionary.imageUploader.highlightPlaceholder(
                              index + 1,
                            )}
                            value={highlight}
                          />
                          <Button
                            onClick={() => removeRecognitionHighlight(index)}
                            size="sm"
                            type="button"
                            variant="outline"
                          >
                            {dictionary.imageUploader.remove}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="rounded-md border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-medium">
                        {dictionary.imageUploader.promptEngine}
                      </h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {dictionary.imageUploader.promptEngineDescription}
                      </p>
                    </div>
                    <select
                      className="h-9 rounded-md border bg-background px-3 text-sm"
                      onChange={(event) =>
                        handlePlatformChange(
                          event.target.value as EcommercePlatform,
                        )
                      }
                      value={selectedPlatform}
                    >
                      {ecommercePlatforms.map((platform) => (
                        <option key={platform} value={platform}>
                          {platformLabels[platform]}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 text-sm">
                    <div className="flex items-center gap-2">
                      <Coins aria-hidden="true" className="size-4" />
                      <span className="text-muted-foreground">
                        {dictionary.imageUploader.remainingCredits}
                      </span>
                      <span className="font-semibold">
                        {creditBalance === null ? "--" : creditBalance}
                      </span>
                    </div>
                    <Button
                      disabled={
                        promptStatus === "generating" ||
                        !result.recognition ||
                        !canAffordPromptGeneration
                      }
                      onClick={() =>
                        result.recognition
                          ? void handlePromptGeneration(
                              result.recognition,
                              selectedPlatform,
                            )
                          : undefined
                      }
                      size="sm"
                      type="button"
                    >
                      {promptStatus === "generating" ? (
                        <Loader2 aria-hidden="true" className="animate-spin" />
                      ) : (
                        <WandSparkles aria-hidden="true" />
                      )}
                      {dictionary.imageUploader.generatePrompts(
                        promptGenerationCreditCost,
                      )}
                    </Button>
                  </div>

                  {!canAffordPromptGeneration ? (
                    <p className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                      {dictionary.imageUploader.promptInsufficientCredits(
                        promptGenerationCreditCost,
                      )}
                    </p>
                  ) : null}

                  {promptStatus === "generating" ? (
                    <div className="mt-4 flex items-center gap-2 rounded-md bg-secondary p-3 text-sm">
                      <Loader2
                        aria-hidden="true"
                        className="size-4 animate-spin"
                      />
                      {dictionary.imageUploader.generatingPrompts}
                    </div>
                  ) : null}

                  {promptError ? (
                    <p className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                      {promptError}
                    </p>
                  ) : null}

                  {prompts ? (
                    <div className="mt-4 space-y-3">
                      {isMainMode ? (
                      <div className="rounded-md border p-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <h4 className="text-sm font-medium">
                              {dictionary.imageUploader.aiImageGeneration}
                            </h4>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <label className="flex items-center gap-2 text-xs text-muted-foreground">
                              {dictionary.dashboard.downloadFormat}
                              <select
                                className="h-9 rounded-md border bg-background px-2 text-sm text-foreground"
                                onChange={(event) =>
                                  setDownloadFormat(
                                    event.target.value as ImageDownloadFormat,
                                  )
                                }
                                value={downloadFormat}
                              >
                                {imageDownloadFormats.map((format) => (
                                  <option key={format} value={format}>
                                    {format === "original"
                                      ? dictionary.dashboard.originalFormat
                                      : format.toUpperCase()}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <Button
                              disabled={
                                !downloadableGeneratedImageCount ||
                                isBatchDownloading
                              }
                              onClick={() =>
                                void handleBatchDownloadGeneratedImages()
                              }
                              size="sm"
                              type="button"
                              variant="outline"
                            >
                              {isBatchDownloading ? (
                                <Loader2
                                  aria-hidden="true"
                                  className="animate-spin"
                                />
                              ) : (
                                <Download aria-hidden="true" />
                              )}
                              {dictionary.imageUploader.batchDownload}
                            </Button>
                            {canMinimizeGenerationPanel ? (
                              <Button
                                onClick={() => {
                                  setIsGenerationPanelMinimized(true);
                                  minimizeBackgroundGeneration();
                                }}
                                size="sm"
                                type="button"
                                variant="outline"
                              >
                                {dictionary.imageUploader.minimizeToProgress}
                              </Button>
                            ) : null}
                            <Button
                              disabled={
                                !isMainMode ||
                                imageQueueStatus === "queueing" ||
                                imageQueueStatus === "processing" ||
                                !canAffordMainImages
                              }
                              onClick={handleGenerateMainImages}
                              size="sm"
                              type="button"
                            >
                              {imageQueueStatus === "queueing" ||
                              imageQueueStatus === "processing" ? (
                                <Loader2
                                  aria-hidden="true"
                                  className="animate-spin"
                                />
                              ) : (
                                <WandSparkles aria-hidden="true" />
                              )}
                              {dictionary.imageUploader.listingSetGenerate(
                                mainImageCreditCost,
                              )}
                            </Button>
                          </div>
                        </div>

                        {isGenerationPanelMinimized ? (
                          <p className="mt-4 rounded-md bg-secondary p-3 text-sm text-muted-foreground">
                            {dictionary.imageUploader.minimizedNotice}
                          </p>
                        ) : null}

                        {!isGenerationPanelMinimized &&
                        imageQueueStatus === "queueing" ? (
                          <div className="mt-4 flex items-center gap-2 rounded-md bg-secondary p-3 text-sm">
                            <Clock3 aria-hidden="true" className="size-4" />
                            {dictionary.imageUploader.queueing}
                          </div>
                        ) : null}

                        {!isGenerationPanelMinimized &&
                        isMainMode &&
                        !canAffordMainImages ? (
                          <p className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                            {dictionary.imageUploader.insufficientCreditsAdjust}
                          </p>
                        ) : null}

                        {!isGenerationPanelMinimized &&
                        imageQueueStatus === "processing" ? (
                          <div className="mt-4 flex items-center gap-2 rounded-md bg-secondary p-3 text-sm">
                            <Loader2
                              aria-hidden="true"
                              className="size-4 animate-spin"
                            />
                            {dictionary.imageUploader.generating}
                          </div>
                        ) : null}

                        {!isGenerationPanelMinimized &&
                        imageQueueStatus === "success" ? (
                          <div className="mt-4 flex items-center gap-2 rounded-md border border-green-600/30 bg-green-50 p-3 text-sm text-green-700">
                            <CheckCircle2
                              aria-hidden="true"
                              className="size-4"
                            />
                            {dictionary.imageUploader.generatedImageSaved}
                          </div>
                        ) : null}

                        {!isGenerationPanelMinimized && imageQueueError ? (
                          <div className="mt-4 space-y-3 rounded-md border border-destructive/30 bg-destructive/10 p-3">
                            <p className="text-sm text-destructive">
                              {imageQueueError}
                            </p>
                            {generatedImageJobs.length ? (
                              <Button
                                onClick={() => {
                                  void refreshGeneratedImages(
                                    generatedImageJobs.map((job) => job.id),
                                  ).then(setGeneratedImageJobs);
                                }}
                                size="sm"
                                type="button"
                                variant="outline"
                              >
                                <RefreshCw aria-hidden="true" />
                                {dictionary.imageUploader.refreshStatus}
                              </Button>
                            ) : null}
                          </div>
                        ) : null}

                        {!isGenerationPanelMinimized && downloadError ? (
                          <p className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                            {downloadError}
                          </p>
                        ) : null}

                        {!isGenerationPanelMinimized && generatedImageJobs.length ? (
                          <div className="mt-4 grid gap-3">
                            {generatedImageJobs.map((job) => (
                              <div
                                className="rounded-md bg-secondary p-3"
                                key={job.id}
                              >
                                <div className="mb-3 flex items-center justify-between gap-3">
                                  <div>
                                    <h5 className="text-sm font-medium">
                                      {getGeneratedImageLabel(job)}
                                    </h5>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                      {job.status === "queued"
                                        ? dictionary.imageUploader.status.queued
                                        : job.status === "processing"
                                          ? dictionary.imageUploader.status
                                              .processing
                                          : job.status === "completed"
                                            ? dictionary.imageUploader.status
                                                .completed
                                            : job.status === "failed"
                                              ? dictionary.imageUploader.status
                                                  .failed
                                            : job.status}
                                    </p>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                      {dictionary.imageUploader.spentCredits(
                                        job.credits_spent,
                                      )}
                                    </p>
                                  </div>
                                  {job.status === "processing" ||
                                  job.status === "queued" ? (
                                    <Loader2
                                      aria-hidden="true"
                                      className="size-4 animate-spin"
                                    />
                                  ) : job.status === "completed" ? (
                                    <CheckCircle2
                                      aria-hidden="true"
                                      className="size-4 text-green-600"
                                    />
                                  ) : job.status === "failed" ? (
                                    <XCircle
                                      aria-hidden="true"
                                      className="size-4 text-destructive"
                                    />
                                  ) : null}
                                </div>
                                {prompts &&
                                getListingPromptForJob(
                                  normalizePromptOutput(prompts),
                                  job,
                                ) ? (
                                  <div className="mb-3 flex flex-wrap gap-2">
                                  <Button
                                    disabled={
                                      imageQueueStatus === "queueing" ||
                                      imageQueueStatus === "processing"
                                    }
                                    onClick={() =>
                                      void handleRegenerateListingImage(job)
                                    }
                                    size="sm"
                                    type="button"
                                    variant="outline"
                                  >
                                    <RefreshCw aria-hidden="true" />
                                    {dictionary.imageUploader.regenerateThisImage}
                                  </Button>
                                  <Button
                                    disabled={
                                      job.status !== "completed" ||
                                      !job.public_url ||
                                      downloadingImageId === job.id
                                    }
                                    onClick={() =>
                                      void handleDownloadGeneratedImage(job)
                                    }
                                    size="sm"
                                    type="button"
                                    variant="outline"
                                  >
                                    {downloadingImageId === job.id ? (
                                      <Loader2
                                        aria-hidden="true"
                                        className="animate-spin"
                                      />
                                    ) : (
                                      <Download aria-hidden="true" />
                                    )}
                                    {dictionary.dashboard.download}
                                  </Button>
                                  </div>
                                ) : null}

                                {job.public_url && job.status === "completed" ? (
                                  <button
                                    className="block w-full cursor-zoom-in rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                                    onClick={() =>
                                      openImagePreview({
                                        alt: dictionary.imageUploader.generatedImageAlt(
                                          getGeneratedImageLabel(job),
                                        ),
                                        src: job.public_url || "",
                                      })
                                    }
                                    type="button"
                                  >
                                    <Image
                                      alt={dictionary.imageUploader.generatedImageAlt(
                                        getGeneratedImageLabel(job),
                                      )}
                                      className="max-h-80 w-full rounded-md object-contain"
                                      height={320}
                                      src={job.public_url}
                                      width={512}
                                    />
                                  </button>
                                ) : null}

                                {job.error_message ? (
                                  <p className="mt-3 text-xs leading-5 text-destructive">
                                    {job.error_message}
                                  </p>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      ) : null}

                      {isDetailMode ? (
                      <div className="rounded-md border p-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <h4 className="text-sm font-medium">
                              {dictionary.imageUploader.detailPage}
                            </h4>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {dictionary.imageUploader.detailPageDescription}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <label className="flex items-center gap-2 text-xs text-muted-foreground">
                              {dictionary.dashboard.downloadFormat}
                              <select
                                className="h-9 rounded-md border bg-background px-2 text-sm text-foreground"
                                onChange={(event) =>
                                  setDownloadFormat(
                                    event.target.value as ImageDownloadFormat,
                                  )
                                }
                                value={downloadFormat}
                              >
                                {imageDownloadFormats.map((format) => (
                                  <option key={format} value={format}>
                                    {format === "original"
                                      ? dictionary.dashboard.originalFormat
                                      : format.toUpperCase()}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <Button
                              disabled={
                                !downloadableGeneratedImageCount ||
                                isBatchDownloading
                              }
                              onClick={() =>
                                void handleBatchDownloadGeneratedImages()
                              }
                              size="sm"
                              type="button"
                              variant="outline"
                            >
                              {isBatchDownloading ? (
                                <Loader2
                                  aria-hidden="true"
                                  className="animate-spin"
                                />
                              ) : (
                                <Download aria-hidden="true" />
                              )}
                              {dictionary.imageUploader.batchDownload}
                            </Button>
                            {canMinimizeGenerationPanel ? (
                              <Button
                                onClick={() => {
                                  setIsGenerationPanelMinimized(true);
                                  minimizeBackgroundGeneration();
                                }}
                                size="sm"
                                type="button"
                                variant="outline"
                              >
                                {dictionary.imageUploader.minimizeToProgress}
                              </Button>
                            ) : null}
                            <Button
                              disabled={
                                !isDetailMode ||
                                imageQueueStatus === "queueing" ||
                                imageQueueStatus === "processing" ||
                                !canAffordDetailPage
                              }
                              onClick={handleGenerateDetailPage}
                              size="sm"
                              type="button"
                            >
                              {imageQueueStatus === "queueing" ||
                              imageQueueStatus === "processing" ? (
                                <Loader2
                                  aria-hidden="true"
                                  className="animate-spin"
                                />
                              ) : (
                                <WandSparkles aria-hidden="true" />
                              )}
                              {dictionary.imageUploader.generateDetailPage(
                                detailPageCreditCost,
                              )}
                            </Button>
                            <Button
                              disabled={
                                !canDownloadDetailPage ||
                                detailPageExportStatus === "exporting"
                              }
                              onClick={() => handleDownloadDetailPage("png")}
                              size="sm"
                              type="button"
                              variant="outline"
                            >
                              <Download aria-hidden="true" />
                              PNG
                            </Button>
                            <Button
                              disabled={
                                !canDownloadDetailPage ||
                                detailPageExportStatus === "exporting"
                              }
                              onClick={() => handleDownloadDetailPage("pdf")}
                              size="sm"
                              type="button"
                              variant="outline"
                            >
                              <FileText aria-hidden="true" />
                              PDF
                            </Button>
                          </div>
                        </div>

                        {isGenerationPanelMinimized ? (
                          <p className="mt-4 rounded-md bg-secondary p-3 text-sm text-muted-foreground">
                            {dictionary.imageUploader.minimizedNotice}
                          </p>
                        ) : null}

                        {!isGenerationPanelMinimized ? (
                        <div className="mt-4 grid gap-3">
                          {isDetailMode && !canAffordDetailPage ? (
                            <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                              {dictionary.imageUploader.detailPageInsufficientCredits(
                                detailPageCreditCost,
                              )}
                            </p>
                          ) : null}

                          {imageQueueStatus === "queueing" ? (
                            <div className="flex items-center gap-2 rounded-md bg-secondary p-3 text-sm">
                              <Clock3 aria-hidden="true" className="size-4" />
                              {dictionary.imageUploader.queueing}
                            </div>
                          ) : null}

                          {imageQueueStatus === "processing" ? (
                            <div className="flex items-center gap-2 rounded-md bg-secondary p-3 text-sm">
                              <Loader2
                                aria-hidden="true"
                                className="size-4 animate-spin"
                              />
                              {dictionary.imageUploader.generating}
                            </div>
                          ) : null}

                          {imageQueueStatus === "success" ? (
                            <div className="flex items-center gap-2 rounded-md border border-green-600/30 bg-green-50 p-3 text-sm text-green-700">
                              <CheckCircle2
                                aria-hidden="true"
                                className="size-4"
                              />
                              {dictionary.imageUploader.generatedImageSaved}
                            </div>
                          ) : null}

                          {imageQueueError ? (
                            <div className="space-y-3 rounded-md border border-destructive/30 bg-destructive/10 p-3">
                              <p className="text-sm text-destructive">
                                {imageQueueError}
                              </p>
                              {generatedImageJobs.length ? (
                                <Button
                                  onClick={() => {
                                    void refreshGeneratedImages(
                                      generatedImageJobs.map((job) => job.id),
                                    ).then(setGeneratedImageJobs);
                                  }}
                                  size="sm"
                                  type="button"
                                  variant="outline"
                                >
                                  <RefreshCw aria-hidden="true" />
                                  {dictionary.imageUploader.refreshStatus}
                                </Button>
                              ) : null}
                            </div>
                          ) : null}

                          {downloadError ? (
                            <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                              {downloadError}
                            </p>
                          ) : null}

                          {isLongDetailMode && generatedImageJobs.length ? (
                            <div className="grid gap-3">
                              {generatedImageJobs.map((job) => (
                                <div
                                  className="rounded-md bg-secondary p-3"
                                  key={job.id}
                                >
                                  <div className="mb-3 flex items-center justify-between gap-3">
                                    <div>
                                      <h5 className="text-sm font-medium">
                                        {getGeneratedImageLabel(job)}
                                      </h5>
                                      <p className="mt-1 text-xs text-muted-foreground">
                                        {dictionary.imageUploader.spentCredits(
                                          job.credits_spent,
                                        )}
                                      </p>
                                    </div>
                                    {job.status === "completed" ? (
                                      <CheckCircle2
                                        aria-hidden="true"
                                        className="size-4 text-green-600"
                                      />
                                    ) : job.status === "processing" ||
                                      job.status === "queued" ? (
                                      <Loader2
                                        aria-hidden="true"
                                        className="size-4 animate-spin"
                                      />
                                    ) : job.status === "failed" ? (
                                      <XCircle
                                        aria-hidden="true"
                                        className="size-4 text-destructive"
                                      />
                                    ) : null}
                                  </div>

                                  {job.public_url &&
                                  job.status === "completed" ? (
                                    <>
                                      <Button
                                        className="mb-3"
                                        disabled={downloadingImageId === job.id}
                                        onClick={() =>
                                          void handleDownloadGeneratedImage(job)
                                        }
                                        size="sm"
                                        type="button"
                                        variant="outline"
                                      >
                                        {downloadingImageId === job.id ? (
                                          <Loader2
                                            aria-hidden="true"
                                            className="animate-spin"
                                          />
                                        ) : (
                                          <Download aria-hidden="true" />
                                        )}
                                        {dictionary.dashboard.download}
                                      </Button>
                                      <button
                                        className="block w-full cursor-zoom-in rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                                        onClick={() =>
                                          openImagePreview({
                                            alt: dictionary.imageUploader.generatedImageAlt(
                                              getGeneratedImageLabel(job),
                                            ),
                                            src: job.public_url || "",
                                          })
                                        }
                                        type="button"
                                      >
                                        <Image
                                          alt={dictionary.imageUploader.generatedImageAlt(
                                            getGeneratedImageLabel(job),
                                          )}
                                          className="max-h-80 w-full rounded-md object-contain"
                                          height={320}
                                          src={job.public_url}
                                          width={512}
                                        />
                                      </button>
                                    </>
                                  ) : null}

                                  {job.error_message ? (
                                    <p className="mt-3 text-xs leading-5 text-destructive">
                                      {job.error_message}
                                    </p>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                          ) : null}

                          {detailGenerationMode === "modules" ? detailPageModules.map((module) => {
                            const job = generatedImageJobs.find(
                              (currentJob) =>
                                getDetailModuleId(currentJob) === module.id,
                            );

                            return (
                              <div
                                className="rounded-md bg-secondary p-3"
                                key={module.id}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <h5 className="text-sm font-medium">
                                      {module.id} · {module.title}
                                    </h5>
                                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                      {module.description}
                                    </p>
                                    {job ? (
                                      <p className="mt-1 text-xs text-muted-foreground">
                                        {dictionary.imageUploader.spentCredits(
                                          job.credits_spent,
                                        )}
                                      </p>
                                    ) : null}
                                  </div>
                                  {job?.status === "completed" ? (
                                    <CheckCircle2
                                      aria-hidden="true"
                                      className="mt-0.5 size-4 text-green-600"
                                    />
                                  ) : job?.status === "processing" ||
                                    job?.status === "queued" ? (
                                    <Loader2
                                      aria-hidden="true"
                                      className="mt-0.5 size-4 animate-spin"
                                    />
                                  ) : job?.status === "failed" ? (
                                    <XCircle
                                      aria-hidden="true"
                                      className="mt-0.5 size-4 text-destructive"
                                    />
                                  ) : null}
                                </div>

                                {job?.public_url &&
                                job.status === "completed" ? (
                                  <>
                                    <Button
                                      className="mt-3"
                                      disabled={downloadingImageId === job.id}
                                      onClick={() =>
                                        void handleDownloadGeneratedImage(job)
                                      }
                                      size="sm"
                                      type="button"
                                      variant="outline"
                                    >
                                      {downloadingImageId === job.id ? (
                                        <Loader2
                                          aria-hidden="true"
                                          className="animate-spin"
                                        />
                                      ) : (
                                        <Download aria-hidden="true" />
                                      )}
                                      {dictionary.dashboard.download}
                                    </Button>
                                    <button
                                      className="mt-3 block w-full cursor-zoom-in rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                                      onClick={() =>
                                        openImagePreview({
                                          alt: dictionary.imageUploader.detailPageModuleAlt(
                                            module.id,
                                          ),
                                          src: job.public_url || "",
                                        })
                                      }
                                      type="button"
                                    >
                                      <Image
                                        alt={dictionary.imageUploader.detailPageModuleAlt(
                                          module.id,
                                        )}
                                        className="max-h-80 w-full rounded-md object-contain"
                                        height={320}
                                        src={job.public_url}
                                        width={512}
                                      />
                                    </button>
                                  </>
                                ) : null}

                                {job?.error_message ? (
                                  <p className="mt-3 text-xs leading-5 text-destructive">
                                    {job.error_message}
                                  </p>
                                ) : null}
                              </div>
                            );
                          }) : null}
                        </div>
                        ) : null}

                        {detailPageExportStatus === "exporting" ? (
                          <div className="mt-4 flex items-center gap-2 rounded-md bg-secondary p-3 text-sm">
                            <Loader2
                              aria-hidden="true"
                              className="size-4 animate-spin"
                            />
                            {dictionary.imageUploader.exportingDetailPage}
                          </div>
                        ) : null}

                        {detailPageExportError ? (
                          <p className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                            {detailPageExportError}
                          </p>
                        ) : null}
                      </div>
                      ) : null}

                      {visiblePromptEntries.length ? (
                        <div className="grid gap-3">
                          {visiblePromptEntries.map((prompt) => (
                            <div
                              className="rounded-md bg-secondary p-3"
                              key={prompt.id}
                            >
                              <div className="mb-2 flex items-center justify-between gap-3">
                                <h4 className="text-sm font-medium">
                                  {prompt.id} · {prompt.title}
                                </h4>
                                <Button
                                  onClick={() =>
                                    navigator.clipboard.writeText(prompt.prompt)
                                  }
                                  size="sm"
                                  type="button"
                                  variant="outline"
                                >
                                  <Copy aria-hidden="true" />
                                  {dictionary.common.copy}
                                </Button>
                              </div>
                              <textarea
                                className="min-h-44 w-full resize-y rounded-md border bg-background px-3 py-2 text-xs leading-5 text-foreground"
                                onChange={(event) =>
                                  updatePromptEntryPrompt(
                                    prompt.id,
                                    event.target.value,
                                  )
                                }
                                value={prompt.prompt}
                              />
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </>
            ) : null}
            <pre className="overflow-auto rounded-md bg-secondary p-3 text-xs leading-6">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        ) : null}
      </div>
      {previewImage ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setPreviewImage(null)}
          role="presentation"
        >
          <div
            className="relative flex max-h-full w-full max-w-6xl flex-col gap-3"
            onClick={(event) => event.stopPropagation()}
            role="presentation"
          >
            <div className="flex items-center justify-between gap-3 text-white">
              <p className="truncate text-sm font-medium">{previewImage.alt}</p>
              <Button
                onClick={() => setPreviewImage(null)}
                size="sm"
                type="button"
                variant="outline"
              >
                {dictionary.imageUploader.closePreview}
              </Button>
            </div>
            <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto rounded-lg bg-background p-2">
              <Image
                alt={previewImage.alt}
                className="max-h-[82vh] w-auto max-w-full object-contain"
                height={1200}
                src={previewImage.src}
                width={1200}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  </div>
  );
}
