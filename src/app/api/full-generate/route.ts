import { NextResponse } from "next/server";

import { getUserCreditBalance, InsufficientCreditsError } from "@/lib/credits";
import {
  processImageGenerationJob,
  queueImageGenerationJob,
} from "@/lib/image-generation/jobs";
import type { GeneratedImageJob, GeneratedImageType } from "@/lib/image-generation/types";
import {
  generatePromptSet,
  getPlatformProfile,
  isEcommercePlatform,
  type PromptEngineInput,
} from "@/lib/prompt-engine";
import { enhancePromptSetWithOpenAI } from "@/lib/prompt-engine/openai";
import { recognizeProductFromImage } from "@/lib/product-recognition";
import { supabaseServer } from "@/lib/supabaseClient";

type SupabaseClient = Awaited<ReturnType<typeof supabaseServer>>;

type WorkflowLogStatus = "started" | "completed" | "failed";

type WorkflowLogEntry = {
  step: string;
  status: WorkflowLogStatus;
  message: string;
  created_at: string;
  metadata?: Record<string, unknown>;
};

type FullGenerateImage = {
  id: string;
  image_type: GeneratedImageType;
  status: GeneratedImageJob["status"];
  url: string | null;
  prompt: string;
  width: number | null;
  height: number | null;
  error_message: string | null;
};

const productImagesBucket = "product-images";
const maxUploadBytes = 10 * 1024 * 1024;
const allowedMimeTypes = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
]);

function asSettings(value: unknown) {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function asWorkflowSettings(value: unknown) {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function asWorkflowLogs(value: unknown): WorkflowLogEntry[] {
  return Array.isArray(value) ? (value as WorkflowLogEntry[]) : [];
}

function imageToResponse(
  imageType: GeneratedImageType,
  job: GeneratedImageJob,
): FullGenerateImage {
  return {
    id: job.id,
    image_type: imageType,
    status: job.status,
    url: job.public_url || null,
    prompt: job.prompt,
    width: job.width,
    height: job.height,
    error_message: job.error_message,
  };
}

async function createWorkflowProject(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("projects")
    .insert({
      user_id: userId,
      name: "Full AI Generation",
      description: "End-to-end product image generation workflow.",
      settings: {
        full_generate: {
          status: "running",
          logs: [],
        },
      },
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data.id as string;
}

async function appendWorkflowLog(input: {
  supabase: SupabaseClient;
  userId: string;
  projectId: string;
  step: string;
  status: WorkflowLogStatus;
  message: string;
  metadata?: Record<string, unknown>;
}) {
  const entry: WorkflowLogEntry = {
    step: input.step,
    status: input.status,
    message: input.message,
    created_at: new Date().toISOString(),
    ...(input.metadata ? { metadata: input.metadata } : {}),
  };

  console.log(
    `[full-generate:${input.projectId}] ${entry.status} ${entry.step}: ${entry.message}`,
    entry.metadata || {},
  );

  const { data, error: selectError } = await input.supabase
    .from("projects")
    .select("settings")
    .eq("id", input.projectId)
    .eq("user_id", input.userId)
    .single();

  if (selectError) {
    throw new Error(selectError.message);
  }

  const settings = asSettings(data.settings);
  const workflow = asWorkflowSettings(settings.full_generate);
  const logs = asWorkflowLogs(workflow.logs);

  const { error: updateError } = await input.supabase
    .from("projects")
    .update({
      settings: {
        ...settings,
        full_generate: {
          ...workflow,
          logs: [...logs, entry],
          last_step: input.step,
          last_status: input.status,
          updated_at: entry.created_at,
        },
      },
    })
    .eq("id", input.projectId)
    .eq("user_id", input.userId);

  if (updateError) {
    throw new Error(updateError.message);
  }
}

async function updateWorkflowProject(input: {
  supabase: SupabaseClient;
  userId: string;
  projectId: string;
  status: "running" | "completed" | "failed";
  patch?: Record<string, unknown>;
}) {
  const { data, error: selectError } = await input.supabase
    .from("projects")
    .select("settings")
    .eq("id", input.projectId)
    .eq("user_id", input.userId)
    .single();

  if (selectError) {
    throw new Error(selectError.message);
  }

  const settings = asSettings(data.settings);
  const workflow = asWorkflowSettings(settings.full_generate);
  const updatedAt = new Date().toISOString();

  const { error: updateError } = await input.supabase
    .from("projects")
    .update({
      settings: {
        ...settings,
        full_generate: {
          ...workflow,
          ...input.patch,
          status: input.status,
          updated_at: updatedAt,
        },
      },
    })
    .eq("id", input.projectId)
    .eq("user_id", input.userId);

  if (updateError) {
    throw new Error(updateError.message);
  }
}

async function uploadProductImage(input: {
  supabase: SupabaseClient;
  userId: string;
  projectId: string;
  image: File;
}) {
  const extension = allowedMimeTypes.get(input.image.type);

  if (!extension) {
    throw new Error("image must be a PNG, JPEG, or WebP file.");
  }

  if (input.image.size <= 0) {
    throw new Error("image cannot be empty.");
  }

  if (input.image.size > maxUploadBytes) {
    throw new Error("image must be 10MB or smaller.");
  }

  const storagePath = `uploads/${input.userId}/${input.projectId}/${crypto.randomUUID()}.${extension}`;
  const { error } = await input.supabase.storage
    .from(productImagesBucket)
    .upload(storagePath, await input.image.arrayBuffer(), {
      cacheControl: "31536000",
      contentType: input.image.type,
      upsert: false,
    });

  if (error) {
    throw new Error(error.message);
  }

  const {
    data: { publicUrl },
  } = input.supabase.storage.from(productImagesBucket).getPublicUrl(storagePath);

  return { imageUrl: publicUrl, storagePath };
}

export async function POST(request: Request) {
  const supabase = await supabaseServer();
  let projectId: string | null = null;
  let userId: string | null = null;
  const images: FullGenerateImage[] = [];

  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    userId = user.id;

    const formData = await request.formData();
    const requestedUserId = formData.get("user_id");
    const image = formData.get("image");
    const rawPlatform = formData.get("platform");
    const platform = isEcommercePlatform(rawPlatform) ? rawPlatform : "taobao";

    if (requestedUserId !== user.id) {
      return NextResponse.json(
        { error: "user_id must match the authenticated user." },
        { status: 403 },
      );
    }

    if (!(image instanceof File)) {
      return NextResponse.json(
        { error: "image file is required." },
        { status: 400 },
      );
    }

    projectId = await createWorkflowProject(supabase, user.id);
    await appendWorkflowLog({
      supabase,
      userId: user.id,
      projectId,
      step: "upload_product_image",
      status: "started",
      message: "Uploading product image.",
      metadata: { filename: image.name, size: image.size, type: image.type },
    });

    const uploaded = await uploadProductImage({
      supabase,
      userId: user.id,
      projectId,
      image,
    });
    await appendWorkflowLog({
      supabase,
      userId: user.id,
      projectId,
      step: "upload_product_image",
      status: "completed",
      message: "Product image uploaded.",
      metadata: { image_url: uploaded.imageUrl, storage_path: uploaded.storagePath },
    });

    await appendWorkflowLog({
      supabase,
      userId: user.id,
      projectId,
      step: "recognize_product",
      status: "started",
      message: "Recognizing product from uploaded image.",
    });
    const { model, rawResponse, recognition } =
      await recognizeProductFromImage(uploaded.imageUrl);
    const { data: recognitionRow, error: recognitionError } = await supabase
      .from("product_recognitions")
      .insert({
        user_id: user.id,
        image_url: uploaded.imageUrl,
        model,
        product_name: recognition.product_name,
        category: recognition.category,
        target_user: recognition.target_user,
        highlights: recognition.highlights,
        raw_response: rawResponse,
      })
      .select("id,product_name,category,target_user,highlights")
      .single();

    if (recognitionError) {
      throw new Error(recognitionError.message);
    }

    await updateWorkflowProject({
      supabase,
      userId: user.id,
      projectId,
      status: "running",
      patch: {
        image_url: uploaded.imageUrl,
        product_recognition_id: recognitionRow.id,
        recognition,
      },
    });
    await appendWorkflowLog({
      supabase,
      userId: user.id,
      projectId,
      step: "recognize_product",
      status: "completed",
      message: "Product recognition completed.",
      metadata: {
        recognition_id: recognitionRow.id,
        product_name: recognition.product_name,
        category: recognition.category,
      },
    });

    await appendWorkflowLog({
      supabase,
      userId: user.id,
      projectId,
      step: "generate_prompts",
      status: "started",
      message: "Generating ecommerce image prompts.",
      metadata: { platform },
    });
    const promptInput: PromptEngineInput = {
      product_name: recognition.product_name,
      category: recognition.category,
      highlights: recognition.highlights,
    };
    const deterministicPrompts = generatePromptSet(promptInput, { platform });
    const prompts =
      process.env.OPENAI_PROMPT_ENGINE_ENABLED === "false"
        ? deterministicPrompts
        : await enhancePromptSetWithOpenAI({
            product: promptInput,
            platformLabel: getPlatformProfile(platform).label,
            prompts: deterministicPrompts,
          });

    await updateWorkflowProject({
      supabase,
      userId: user.id,
      projectId,
      status: "running",
      patch: { platform, prompts },
    });
    await appendWorkflowLog({
      supabase,
      userId: user.id,
      projectId,
      step: "generate_prompts",
      status: "completed",
      message: "Prompt engine completed.",
      metadata: { prompt_roles: ["main_image", "lifestyle", "infographic"] },
    });

    const imagePlans: Array<{
      imageType: GeneratedImageType;
      prompt: string;
    }> = [
      { imageType: "main_image", prompt: prompts.mainImagePrompt },
      { imageType: "lifestyle", prompt: prompts.lifestylePrompt },
      { imageType: "infographic", prompt: prompts.infographicPrompt },
    ];

    for (const plan of imagePlans) {
      await appendWorkflowLog({
        supabase,
        userId: user.id,
        projectId,
        step: `queue_${plan.imageType}`,
        status: "started",
        message: `Queueing ${plan.imageType} generation job.`,
      });
      const queuedJob = await queueImageGenerationJob({
        supabase,
        userId: user.id,
        projectId,
        imageType: plan.imageType,
        prompt: plan.prompt,
        platform,
        recognitionId: recognitionRow.id,
      });
      await appendWorkflowLog({
        supabase,
        userId: user.id,
        projectId,
        step: `queue_${plan.imageType}`,
        status: "completed",
        message: `${plan.imageType} generation job queued.`,
        metadata: { job_id: queuedJob.id },
      });

      await appendWorkflowLog({
        supabase,
        userId: user.id,
        projectId,
        step: `generate_${plan.imageType}`,
        status: "started",
        message: `Generating ${plan.imageType} image.`,
        metadata: { job_id: queuedJob.id },
      });
      const completedJob = await processImageGenerationJob({
        supabase,
        userId: user.id,
        jobId: queuedJob.id,
      });
      images.push(imageToResponse(plan.imageType, completedJob));
      await appendWorkflowLog({
        supabase,
        userId: user.id,
        projectId,
        step: `generate_${plan.imageType}`,
        status: "completed",
        message: `${plan.imageType} image generated.`,
        metadata: {
          job_id: completedJob.id,
          public_url: completedJob.public_url || null,
        },
      });
    }

    const creditBalance = await getUserCreditBalance(supabase, user.id);
    await updateWorkflowProject({
      supabase,
      userId: user.id,
      projectId,
      status: "completed",
      patch: {
        image_ids: images.map((imageItem) => imageItem.id),
        credit_balance: creditBalance,
      },
    });
    await appendWorkflowLog({
      supabase,
      userId: user.id,
      projectId,
      step: "return_response",
      status: "completed",
      message: "Full generation workflow completed.",
      metadata: { image_count: images.length, credit_balance: creditBalance },
    });

    return NextResponse.json({ project_id: projectId, images });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Full generation failed.";

    if (projectId && userId) {
      await appendWorkflowLog({
        supabase,
        userId,
        projectId,
        step: "workflow",
        status: "failed",
        message,
        metadata: { partial_image_count: images.length },
      }).catch((logError) => {
        console.error("[full-generate] failed to write failure log", logError);
      });

      await updateWorkflowProject({
        supabase,
        userId,
        projectId,
        status: "failed",
        patch: { error_message: message },
      }).catch((statusError) => {
        console.error("[full-generate] failed to update workflow status", statusError);
      });
    }

    return NextResponse.json(
      {
        project_id: projectId,
        images,
        error: message,
        recoverable: Boolean(projectId),
      },
      { status: error instanceof InsufficientCreditsError ? 402 : 500 },
    );
  }
}
