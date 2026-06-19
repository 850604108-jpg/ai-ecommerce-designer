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

import { useLanguage } from "@/components/i18n/language-provider";
import { Button } from "@/components/ui/button";
import {
  getSupabasePublicConfig,
  getSupabaseStorageBucket,
  supabaseBrowser,
} from "@/lib/supabaseClient";
import {
  ecommercePlatforms,
  type EcommercePlatform,
  type PromptEngineOutput,
} from "@/lib/prompt-engine";
import {
  imageGenerationCreditCosts,
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

type PromptImageConfig = {
  imageType: GeneratedImageType;
  promptKey: keyof Pick<
    PromptEngineOutput,
    "mainImagePrompt" | "lifestylePrompt" | "infographicPrompt"
  >;
};

type ImageQueueState = "idle" | "queueing" | "processing" | "success" | "error";

type ExportState = "idle" | "exporting" | "error";

const imagePromptConfigs: PromptImageConfig[] = [
  { imageType: "main_image", promptKey: "mainImagePrompt" },
  { imageType: "lifestyle", promptKey: "lifestylePrompt" },
  { imageType: "infographic", promptKey: "infographicPrompt" },
];

const coreImageCreditCost = imagePromptConfigs.reduce(
  (total, config) => total + imageGenerationCreditCosts[config.imageType],
  0,
);

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

function encodePath(path: string) {
  return path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function createObjectPath(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const safeBaseName =
    file.name
      .replace(/\.[^/.]+$/, "")
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "image";

  return `uploads/${Date.now()}-${crypto.randomUUID()}-${safeBaseName}.${extension}`;
}

function uploadToSupabaseStorage(
  file: File,
  onProgress: (progress: number) => void,
) {
  return new Promise<UploadResult>(async (resolve, reject) => {
    try {
      const supabase = supabaseBrowser();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const { supabaseAnonKey, supabaseUrl } = getSupabasePublicConfig();
      const bucket = getSupabaseStorageBucket();
      const objectPath = createObjectPath(file);
      const uploadUrl = `${supabaseUrl}/storage/v1/object/${bucket}/${encodePath(
        objectPath,
      )}`;

      const request = new XMLHttpRequest();

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
              message?: string;
            };
            message = response.message || response.error || message;
          } catch {
            // Keep the fallback message when Supabase returns plain text.
          }

          reject(new Error(message));
          return;
        }

        const imageUrl = `${supabaseUrl}/storage/v1/object/public/${bucket}/${encodePath(
          objectPath,
        )}`;

        onProgress(100);
        resolve({ imageUrl });
      };

      request.open("POST", uploadUrl);
      request.setRequestHeader("apikey", supabaseAnonKey);
      request.setRequestHeader(
        "Authorization",
        `Bearer ${session?.access_token || supabaseAnonKey}`,
      );
      request.setRequestHeader("Content-Type", file.type);
      request.setRequestHeader("x-upsert", "false");
      request.send(file);
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
    error?: string;
    prompts?: unknown;
  };

  if (!response.ok || !payload.prompts) {
    throw new Error(payload.error || "Prompt generation failed.");
  }

  return normalizePromptOutput(payload.prompts);
}

async function queueGeneratedImage(input: {
  imageType: GeneratedImageType;
  prompt: string;
  platform: EcommercePlatform;
  recognitionId?: string;
  moduleId?: string;
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
  context.fillRect(0, 0, width, height);

  let offsetY = 0;
  images.forEach((image) => {
    context.drawImage(image, 0, offsetY, width, image.naturalHeight);
    offsetY += image.naturalHeight;
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

export function ImageUploader() {
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
      await handlePromptGeneration(recognition, selectedPlatform);
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
      const nextPrompts = await generatePrompts(recognition, platform);
      setPrompts(nextPrompts);
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
    setGeneratedImageJobs([]);
    setDetailPageExportStatus("idle");
    setDetailPageExportError("");

    if (result?.recognition) {
      void handlePromptGeneration(result.recognition, platform);
    }
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

  async function handleGenerateImages() {
    if (!prompts || imageQueueStatus === "queueing") {
      return;
    }

    setImageQueueStatus("queueing");
    setImageQueueError("");
    setGeneratedImageJobs([]);

    let queuedJobs: GeneratedImageJob[] = [];

    try {
      const queuedResults = await Promise.all(
        imagePromptConfigs.map((config) =>
          queueGeneratedImage({
            imageType: config.imageType,
            prompt: prompts[config.promptKey],
            platform: selectedPlatform,
            recognitionId: result?.recognition?.id,
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
    const detailModules = normalizePromptOutput(prompts).detailPageModules;

    if (!detailModules.length || imageQueueStatus === "queueing") {
      return;
    }

    setImageQueueStatus("queueing");
    setImageQueueError("");
    setDetailPageExportStatus("idle");
    setDetailPageExportError("");
    setGeneratedImageJobs([]);

    let queuedJobs: GeneratedImageJob[] = [];

    try {
      const queuedResults = await Promise.all(
        detailModules.map((module) =>
          queueGeneratedImage({
            imageType: "detail_page_module",
            prompt: module.imagePrompt,
            platform: selectedPlatform,
            recognitionId: result?.recognition?.id,
            moduleId: module.id,
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
  const detailPageModules = normalizedPrompts.detailPageModules;
  const detailPageJobs = getDetailPageJobs(generatedImageJobs);
  const canDownloadDetailPage =
    Boolean(detailPageModules.length) &&
    detailPageJobs.length === detailPageModules.length;
  const detailPageCreditCost =
    detailPageModules.length * imageGenerationCreditCosts.detail_page_module;
  const canAffordCoreImages =
    creditBalance === null || creditBalance >= coreImageCreditCost;
  const canAffordDetailPage =
    creditBalance === null || creditBalance >= detailPageCreditCost;

  return (
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
            disabled={!file || status === "uploading"}
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
                      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 text-sm">
                        <div className="flex items-center gap-2">
                          <Coins aria-hidden="true" className="size-4" />
                          <span className="text-muted-foreground">
                            {dictionary.imageUploader.remainingCredits}
                          </span>
                        </div>
                        <span className="font-semibold">
                          {creditBalance === null ? "--" : creditBalance}
                        </span>
                      </div>

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
                          <Button
                            disabled={
                              imageQueueStatus === "queueing" ||
                              imageQueueStatus === "processing" ||
                              !canAffordCoreImages
                            }
                            onClick={handleGenerateImages}
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
                            {dictionary.imageUploader.generateCoreImages(
                              coreImageCreditCost,
                            )}
                          </Button>
                        </div>

                        {imageQueueStatus === "queueing" ? (
                          <div className="mt-4 flex items-center gap-2 rounded-md bg-secondary p-3 text-sm">
                            <Clock3 aria-hidden="true" className="size-4" />
                            {dictionary.imageUploader.queueing}
                          </div>
                        ) : null}

                        {!canAffordCoreImages ? (
                          <p className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                            {dictionary.imageUploader.coreImageInsufficientCredits(
                              coreImageCreditCost,
                            )}
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
                          <div className="flex flex-wrap gap-2">
                            <Button
                              disabled={
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
                          {!canAffordDetailPage ? (
                            <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                              {dictionary.imageUploader.detailPageInsufficientCredits(
                                detailPageCreditCost,
                              )}
                            </p>
                          ) : null}

                          {detailPageModules.map((module) => {
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
                          })}
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
  );
}
