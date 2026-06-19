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

import { useLanguage } from "@/components/i18n/language-provider";
import { Button } from "@/components/ui/button";
import {
  ecommercePlatforms,
  type EcommercePlatform,
  type PromptEngineOutput,
} from "@/lib/prompt-engine";
import {
  imageGenerationCreditCosts,
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
  mainImagePrompt: "",
};

type RecognitionState = "idle" | "recognizing" | "success" | "error";

type PromptState = "idle" | "generating" | "success" | "error";

type ImageQueueState = "idle" | "queueing" | "processing" | "success" | "error";

type ExportState = "idle" | "exporting" | "error";
type GenerationMode = "main" | "detail";
type DetailGenerationMode = "modules" | "long";

const mainImageCountOptions = [1, 2, 3, 4, 5, 6, 7, 8] as const;
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
  };

  if (!response.ok || !payload.recognition) {
    throw new Error(payload.error || "Product recognition failed.");
  }

  return {
    ...payload.recognition,
    highlights: Array.isArray(payload.recognition.highlights)
      ? payload.recognition.highlights
      : [],
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
    mainImagePrompt:
      typeof record.mainImagePrompt === "string" ? record.mainImagePrompt : "",
  };
}

async function generatePrompts(
  recognition: ProductRecognitionResult,
  platform: EcommercePlatform,
) {
  const response = await fetch("/api/prompt-engine", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      platform,
      product_name: recognition.product_name,
      category: recognition.category,
      highlights: recognition.highlights,
    }),
  });
  const payload = (await response.json().catch(() => ({
    error: "Prompt generation returned an invalid response.",
  }))) as {
    credit_balance?: number | null;
    error?: string;
    prompts?: unknown;
  };

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
      size: input.size,
    }),
  });
  const payload = (await response.json()) as {
    credit_balance?: number | null;
    error?: string;
    job?: GeneratedImageJob;
  };

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
  const payload = (await response.json()) as {
    credit_balance?: number | null;
    error?: string;
    job?: GeneratedImageJob;
  };

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
  const payload = (await response.json()) as {
    credit_balance?: number;
    error?: string;
  };

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
  const payload = (await response.json()) as {
    error?: string;
    jobs?: GeneratedImageJob[];
  };

  if (!response.ok || !payload.jobs) {
    throw new Error(payload.error || "Failed to refresh image jobs.");
  }

  return payload.jobs;
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

function buildMainImagePromptVariant(prompt: string, index: number, total: number) {
  return [
    prompt,
    `本次生成主图 AM-${String(index + 1).padStart(2, "0")} / ${total}。`,
    "保持 1:1 方图，商品完整清晰，白底或浅色干净商业背景，适合作为电商主图候选。",
    "同批多张主图之间只变化角度、光线、摆放层次或轻量道具，不改变商品结构、颜色、包装文字和真实比例。",
  ].join("\n\n");
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
  const [mainImageCount, setMainImageCount] = useState<number>(1);
  const [detailStartId, setDetailStartId] = useState<string>("AD-01");
  const [detailEndId, setDetailEndId] = useState<string>("AD-06");
  const [detailAspect, setDetailAspect] =
    useState<(typeof detailAspectOptions)[number]["value"]>("wide");
  const [prompts, setPrompts] = useState<PromptEngineOutput | null>(null);
  const [imageQueueStatus, setImageQueueStatus] =
    useState<ImageQueueState>("idle");
  const [imageQueueError, setImageQueueError] = useState("");
  const [generatedImageJobs, setGeneratedImageJobs] = useState<
    GeneratedImageJob[]
  >([]);
  const [detailPageExportStatus, setDetailPageExportStatus] =
    useState<ExportState>("idle");
  const [detailPageExportError, setDetailPageExportError] = useState("");
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void loadCreditBalance()
      .then(setCreditBalance)
      .catch(() => setCreditBalance(null));
  }, []);

  useEffect(() => {
    if (!file) {
      setPreviewUrl("");
      return;
    }

    const nextPreviewUrl = URL.createObjectURL(file);
    setPreviewUrl(nextPreviewUrl);

    return () => {
      URL.revokeObjectURL(nextPreviewUrl);
    };
  }, [file]);

  function selectFile(nextFile?: File) {
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
      const recognition = await recognizeProductFromPayload({
        imageDataUrl,
        imageUrl: uploadResult.imageUrl,
      });
      setResult({ ...uploadResult, recognition });
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

  async function handlePromptGeneration(
    recognition: ProductRecognitionResult,
    platform: EcommercePlatform,
  ) {
    setPromptStatus("generating");
    setPromptError("");
    setPrompts(null);

    try {
      const result = await generatePrompts(recognition, platform);
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
        return [nextJob, ...currentJobs];
      }

      const nextJobs = [...currentJobs];
      nextJobs[existingIndex] = nextJob;
      return nextJobs;
    });
  }

  async function handleGenerateMainImages() {
    if (!prompts || imageQueueStatus === "queueing") {
      return;
    }

    setImageQueueStatus("queueing");
    setImageQueueError("");
    setGeneratedImageJobs([]);

    let queuedJobs: GeneratedImageJob[] = [];

    try {
      const queuedResults = await Promise.all(
        Array.from({ length: mainImageCount }, (_, index) =>
          queueGeneratedImage({
            imageType: "main_image",
            prompt: buildMainImagePromptVariant(
              prompts.mainImagePrompt,
              index,
              mainImageCount,
            ),
            platform: selectedPlatform,
            recognitionId: result?.recognition?.id,
            moduleId: `AM-${String(index + 1).padStart(2, "0")}`,
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

      setGeneratedImageJobs(queuedJobs);
      setImageQueueStatus("processing");

      await Promise.all(
        queuedJobs.map(async (job) => {
          upsertGeneratedImageJob({ ...job, status: "processing" });
          const processed = await processGeneratedImage(job.id);

          if (processed.creditBalance !== null) {
            setCreditBalance(processed.creditBalance);
          }

          upsertGeneratedImageJob(processed.job);
        }),
      );

      setImageQueueStatus("success");
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
        setGeneratedImageJobs(refreshedJobs);
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

      await Promise.all(
        queuedJobs.map(async (job) => {
          upsertGeneratedImageJob({ ...job, status: "processing" });
          const processed = await processGeneratedImage(job.id);

          if (processed.creditBalance !== null) {
            setCreditBalance(processed.creditBalance);
          }

          upsertGeneratedImageJob(processed.job);
        }),
      );

      setImageQueueStatus("success");
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
    mainImageCount * imageGenerationCreditCosts.main_image;
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

  return (
    <div className="space-y-5">
      <div className="rounded-lg border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-medium">生成设置</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              先选择要生成的图片类型和规格，再上传图片识别商品信息。
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
              主图
            </Button>
            <Button
              className={cn(
                isDetailMode && "border-primary bg-secondary",
              )}
              onClick={() => setGenerationMode("detail")}
              type="button"
              variant={isDetailMode ? "default" : "outline"}
            >
              详情页
            </Button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {isMainMode ? (
          <div className="rounded-md border p-3 lg:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-medium">主图生成</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  主图固定为 1:1 方图，每张消耗 1 Credit。
                </p>
              </div>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                数量
                <select
                  className="h-8 rounded-md border bg-background px-2 text-sm text-foreground"
                  onChange={(event) =>
                    setMainImageCount(Number(event.target.value))
                  }
                  value={mainImageCount}
                >
                  {mainImageCountOptions.map((count) => (
                    <option key={count} value={count}>
                      {count}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
          ) : null}

          {isDetailMode ? (
          <div className="rounded-md border p-3 lg:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-medium">详情页生成</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  可生成 AD 模块组，也可单独生成一张完整 9:32 详情页长图。
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => setDetailGenerationMode("modules")}
                  size="sm"
                  type="button"
                  variant={detailGenerationMode === "modules" ? "default" : "outline"}
                >
                  AD 模块
                </Button>
                <Button
                  onClick={() => setDetailGenerationMode("long")}
                  size="sm"
                  type="button"
                  variant={detailGenerationMode === "long" ? "default" : "outline"}
                >
                  9:32 长图
                </Button>
              </div>
            </div>

            {detailGenerationMode === "modules" ? (
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  从
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
                  到
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
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <p className="mt-3 rounded-md bg-secondary p-3 text-xs leading-5 text-muted-foreground">
                9:32 长图会作为独立生成任务，只生成一张完整详情页长图，提示词按 Amazon A+/详情页完整页面结构组织。
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
                <div className="space-y-3 rounded-md bg-secondary p-3 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">
                      {dictionary.imageUploader.product}
                    </span>
                    <span className="text-right font-medium">
                      {result.recognition.product_name ||
                        dictionary.common.unknown}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">
                      {dictionary.imageUploader.category}
                    </span>
                    <span className="text-right font-medium">
                      {result.recognition.category || dictionary.common.unknown}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">
                      {dictionary.imageUploader.targetUser}
                    </span>
                    <span className="text-right font-medium">
                      {result.recognition.target_user ||
                        dictionary.common.unknown}
                    </span>
                  </div>
                  {result.recognition.highlights.length ? (
                    <div>
                      <span className="text-muted-foreground">
                        {dictionary.imageUploader.highlights}
                      </span>
                      <ul className="mt-2 list-disc space-y-1 pl-5">
                        {result.recognition.highlights.map((highlight) => (
                          <li key={highlight}>{highlight}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
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
                            <p className="mt-1 text-xs text-muted-foreground">
                              {
                                dictionary.imageUploader
                                  .aiImageGenerationDescription
                              }
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
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
                              主图 1:1 · {mainImageCreditCost} Credits
                            </Button>
                          </div>
                        </div>

                        {imageQueueStatus === "queueing" ? (
                          <div className="mt-4 flex items-center gap-2 rounded-md bg-secondary p-3 text-sm">
                            <Clock3 aria-hidden="true" className="size-4" />
                            {dictionary.imageUploader.queueing}
                          </div>
                        ) : null}

                        {isMainMode && !canAffordMainImages ? (
                          <p className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                            剩余积分不足，请减少生成数量或先补充积分。
                          </p>
                        ) : null}

                        {imageQueueStatus === "processing" ? (
                          <div className="mt-4 flex items-center gap-2 rounded-md bg-secondary p-3 text-sm">
                            <Loader2
                              aria-hidden="true"
                              className="size-4 animate-spin"
                            />
                            {dictionary.imageUploader.generating}
                          </div>
                        ) : null}

                        {imageQueueStatus === "success" ? (
                          <div className="mt-4 flex items-center gap-2 rounded-md border border-green-600/30 bg-green-50 p-3 text-sm text-green-700">
                            <CheckCircle2
                              aria-hidden="true"
                              className="size-4"
                            />
                            {dictionary.imageUploader.generatedImageSaved}
                          </div>
                        ) : null}

                        {imageQueueError ? (
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

                        {generatedImageJobs.length ? (
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

                                {job.public_url && job.status === "completed" ? (
                                  <Image
                                    alt={dictionary.imageUploader.generatedImageAlt(
                                      getGeneratedImageLabel(job),
                                    )}
                                    className="max-h-80 w-full rounded-md object-contain"
                                    height={320}
                                    src={job.public_url}
                                    width={512}
                                  />
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
                                    <Image
                                      alt={dictionary.imageUploader.generatedImageAlt(
                                        getGeneratedImageLabel(job),
                                      )}
                                      className="max-h-80 w-full rounded-md object-contain"
                                      height={320}
                                      src={job.public_url}
                                      width={512}
                                    />
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
                                  <Image
                                    alt={dictionary.imageUploader.detailPageModuleAlt(
                                      module.id,
                                    )}
                                    className="mt-3 max-h-80 w-full rounded-md object-contain"
                                    height={320}
                                    src={job.public_url}
                                    width={512}
                                  />
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

                      {Object.entries(normalizedPrompts)
                        .filter(([, value]) => typeof value === "string")
                        .map(([key, value]) => (
                        <div key={key} className="rounded-md bg-secondary p-3">
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <h4 className="text-sm font-medium">{key}</h4>
                            <Button
                              onClick={() =>
                                navigator.clipboard.writeText(value as string)
                              }
                              size="sm"
                              type="button"
                              variant="outline"
                            >
                              <Copy aria-hidden="true" />
                              {dictionary.common.copy}
                            </Button>
                          </div>
                          <p className="max-h-44 overflow-auto whitespace-pre-wrap text-xs leading-5 text-muted-foreground">
                            {value as string}
                          </p>
                        </div>
                      ))}
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
    </div>
    </div>
  );
}
