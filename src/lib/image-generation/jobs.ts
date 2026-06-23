import { supabaseServer } from "@/lib/supabaseClient";
import { defaultOpenAIImageModel } from "@/lib/openai/client";
import {
  deductImageGenerationCredits,
  getImageGenerationCreditCost,
  refundImageGenerationCredits,
  spendImageGenerationCredits,
} from "@/lib/credits";

import { generateImageWithOpenAI } from "./openai";
import {
  isGeneratedImageSize,
  isGeneratedImageType,
  type GeneratedImageSize,
  type GeneratedImageHistoryJob,
  type GeneratedImageJob,
  type GeneratedImageType,
} from "./types";

type SupabaseClient = Awaited<ReturnType<typeof supabaseServer>>;

export const generatedImagesBucket = "generated-images";

const defaultImageModel = defaultOpenAIImageModel;
const defaultSize = "1024x1024";
const defaultQuality = "medium";
const defaultOutputFormat = "webp";
const historySelect =
  "id,project_id,prompt,model,storage_bucket,storage_path,status,width,height,credits_spent,error_message,generation_params,metadata,created_at,updated_at,project:projects(id,name,description,status,created_at)";
const jobSelect =
  "id,project_id,prompt,model,storage_bucket,storage_path,status,width,height,credits_spent,error_message,generation_params,metadata,created_at,updated_at";

function getPublicUrl(
  supabase: SupabaseClient,
  bucket: string,
  storagePath: string | null,
) {
  if (!storagePath) {
    return null;
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(bucket).getPublicUrl(storagePath);

  return publicUrl;
}

function withPublicUrl(
  supabase: SupabaseClient,
  job: GeneratedImageJob,
): GeneratedImageJob {
  return {
    ...job,
    public_url: getPublicUrl(supabase, job.storage_bucket, job.storage_path),
  };
}

function getRecognitionId(value: Record<string, unknown>) {
  return typeof value.product_recognition_id === "string"
    ? value.product_recognition_id
    : null;
}

async function getProductReferenceImageUrl(input: {
  supabase: SupabaseClient;
  userId: string;
  recognitionId: string | null;
}) {
  if (!input.recognitionId) {
    return null;
  }

  const { data, error } = await input.supabase
    .from("product_recognitions")
    .select("image_url")
    .eq("id", input.recognitionId)
    .eq("user_id", input.userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const imageUrl = typeof data?.image_url === "string" ? data.image_url : "";

  return URL.canParse(imageUrl) ? imageUrl : null;
}

async function getOrCreateGenerationProject(
  supabase: SupabaseClient,
  userId: string,
) {
  const { data: existingProject, error: selectError } = await supabase
    .from("projects")
    .select("id")
    .eq("user_id", userId)
    .eq("settings->>system_key", "ai-image-generation")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (selectError) {
    throw new Error(selectError.message);
  }

  if (existingProject?.id) {
    return existingProject.id as string;
  }

  const { data: project, error: insertError } = await supabase
    .from("projects")
    .insert({
      user_id: userId,
      name: "AI Image Generation",
      description: "Default project for generated ecommerce images.",
      settings: { system_key: "ai-image-generation" },
    })
    .select("id")
    .single();

  if (insertError) {
    throw new Error(insertError.message);
  }

  return project.id as string;
}

export async function queueImageGenerationJob(input: {
  supabase: SupabaseClient;
  userId: string;
  imageType: GeneratedImageType;
  prompt: string;
  platform?: string;
  projectId?: string;
  recognitionId?: string | null;
  moduleId?: string | null;
  styleReferenceImageUrl?: string | null;
  size?: GeneratedImageSize;
}) {
  const prompt = input.prompt.trim();

  if (!prompt) {
    throw new Error("Prompt is required.");
  }

  const projectId =
    input.projectId ||
    (await getOrCreateGenerationProject(input.supabase, input.userId));

  const size =
    input.size ||
    (input.imageType === "detail_page_module" ? "1536x1024" : defaultSize);
  const [width, height] = size.split("x").map(Number);
  const creditCost = getImageGenerationCreditCost(input.imageType);

  const { data, error } = await input.supabase
    .from("generated_images")
    .insert({
      user_id: input.userId,
      project_id: projectId,
      prompt,
      model: defaultImageModel,
      storage_bucket: generatedImagesBucket,
      status: "queued",
      width,
      height,
      credits_spent: creditCost,
      generation_params: {
        size,
        quality: defaultQuality,
        output_format: defaultOutputFormat,
      },
      metadata: {
        image_type: input.imageType,
        platform: input.platform || null,
        product_recognition_id: input.recognitionId || null,
        style_reference_image_url: input.styleReferenceImageUrl || null,
        module_id: input.moduleId || null,
      },
    })
    .select(jobSelect)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const job = data as GeneratedImageJob;

  try {
    await deductImageGenerationCredits({
      supabase: input.supabase,
      userId: input.userId,
      projectId,
      generatedImageId: job.id,
      imageType: input.imageType,
    });
  } catch (deductError) {
    await input.supabase
      .from("generated_images")
      .update({
        status: "failed",
        credits_spent: 0,
        error_message:
          deductError instanceof Error
            ? deductError.message
            : "Failed to deduct credits.",
      })
      .eq("id", job.id)
      .eq("user_id", input.userId);

    throw deductError;
  }

  return withPublicUrl(input.supabase, job);
}

export async function listImageGenerationJobs(
  supabase: SupabaseClient,
  ids: string[],
) {
  if (!ids.length) {
    return [];
  }

  const { data, error } = await supabase
    .from("generated_images")
    .select(jobSelect)
    .in("id", ids)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data as GeneratedImageJob[]).map((job) =>
    withPublicUrl(supabase, job),
  );
}

function normalizeSearchTerm(value: string) {
  return value.trim().replace(/[%_,]/g, " ").replace(/\s+/g, " ").slice(0, 80);
}

function getImageType(value: Record<string, unknown>) {
  return isGeneratedImageType(value.image_type) ? value.image_type : null;
}

function normalizeHistoryJob(
  supabase: SupabaseClient,
  job: GeneratedImageHistoryJob & {
    project?:
      | GeneratedImageHistoryJob["project"]
      | GeneratedImageHistoryJob["project"][];
  },
) {
  const project = Array.isArray(job.project)
    ? job.project[0] || null
    : job.project || null;

  return withPublicUrl(supabase, {
    ...job,
    project,
  } as GeneratedImageHistoryJob) as GeneratedImageHistoryJob;
}

export async function listImageGenerationHistory(input: {
  supabase: SupabaseClient;
  userId: string;
  search?: string;
  page?: number;
  pageSize?: number;
}) {
  const pageSize = Math.min(Math.max(input.pageSize || 8, 1), 24);
  const page = Math.max(input.page || 1, 1);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const search = normalizeSearchTerm(input.search || "");
  let matchingProjectIds: string[] = [];

  if (search) {
    const { data: projects, error: projectSearchError } = await input.supabase
      .from("projects")
      .select("id")
      .eq("user_id", input.userId)
      .or(`name.ilike.%${search}%,description.ilike.%${search}%`)
      .limit(50);

    if (projectSearchError) {
      throw new Error(projectSearchError.message);
    }

    matchingProjectIds = (projects || []).map((project) => project.id as string);
  }

  let query = input.supabase
    .from("generated_images")
    .select(historySelect, { count: "exact" })
    .eq("user_id", input.userId)
    .neq("status", "deleted");

  if (search) {
    const filters = [`prompt.ilike.%${search}%`];

    if (matchingProjectIds.length) {
      filters.push(`project_id.in.(${matchingProjectIds.join(",")})`);
    }

    query = query.or(filters.join(","));
  }

  const { count, data, error } = await query
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    throw new Error(error.message);
  }

  const { count: projectCount, error: projectCountError } = await input.supabase
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("user_id", input.userId);

  if (projectCountError) {
    throw new Error(projectCountError.message);
  }

  return {
    jobs: (data as unknown as GeneratedImageHistoryJob[]).map((job) =>
      normalizeHistoryJob(input.supabase, job),
    ),
    page,
    pageCount: Math.max(Math.ceil((count || 0) / pageSize), 1),
    pageSize,
    projectCount: projectCount || 0,
    totalCount: count || 0,
  };
}

export async function softDeleteImageGenerationJob(input: {
  supabase: SupabaseClient;
  userId: string;
  jobId: string;
}) {
  const { data, error } = await input.supabase
    .from("generated_images")
    .update({ status: "deleted", error_message: null })
    .eq("id", input.jobId)
    .eq("user_id", input.userId)
    .neq("status", "deleted")
    .select(jobSelect)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return withPublicUrl(input.supabase, data as GeneratedImageJob);
}

export async function regenerateImageGenerationJob(input: {
  supabase: SupabaseClient;
  userId: string;
  jobId: string;
}) {
  const { data, error } = await input.supabase
    .from("generated_images")
    .select("prompt,metadata,generation_params")
    .eq("id", input.jobId)
    .eq("user_id", input.userId)
    .neq("status", "deleted")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const metadata = (data.metadata || {}) as Record<string, unknown>;
  const imageType = getImageType(metadata);

  if (!imageType) {
    throw new Error("This history item cannot be regenerated.");
  }

  return queueImageGenerationJob({
    supabase: input.supabase,
    userId: input.userId,
    imageType,
    prompt: data.prompt as string,
    platform: typeof metadata.platform === "string" ? metadata.platform : "",
    recognitionId:
      getRecognitionId(metadata),
    styleReferenceImageUrl:
      typeof metadata.style_reference_image_url === "string" &&
      URL.canParse(metadata.style_reference_image_url)
        ? metadata.style_reference_image_url
        : null,
    moduleId: typeof metadata.module_id === "string" ? metadata.module_id : null,
    size: isGeneratedImageSize(
      (data.generation_params as Record<string, unknown> | null)?.size,
    )
      ? ((data.generation_params as Record<string, unknown>).size as GeneratedImageSize)
      : undefined,
  });
}

export async function processImageGenerationJob(input: {
  supabase: SupabaseClient;
  userId: string;
  jobId: string;
}) {
  const { data: job, error: selectError } = await input.supabase
    .from("generated_images")
    .select(jobSelect)
    .eq("id", input.jobId)
    .eq("user_id", input.userId)
    .single();

  if (selectError) {
    throw new Error(selectError.message);
  }

  const currentJob = job as GeneratedImageJob;

  if (currentJob.status === "completed") {
    return withPublicUrl(input.supabase, currentJob);
  }

  if (currentJob.status === "deleted") {
    throw new Error("Deleted image jobs cannot be processed.");
  }

  if (currentJob.status === "processing") {
    return withPublicUrl(input.supabase, currentJob);
  }

  if (currentJob.status === "failed") {
    throw new Error("Failed image jobs cannot be processed.");
  }

  const generationParams = currentJob.generation_params || {};
  const size =
    generationParams.size === "1024x1536" ||
    generationParams.size === "1536x1024" ||
    generationParams.size === "1024x1024"
      ? generationParams.size
      : defaultSize;
  const quality =
    generationParams.quality === "low" ||
    generationParams.quality === "high" ||
    generationParams.quality === "medium"
      ? generationParams.quality
      : defaultQuality;
  const outputFormat =
    generationParams.output_format === "webp" ||
    generationParams.output_format === "jpeg" ||
    generationParams.output_format === "png"
      ? generationParams.output_format
      : defaultOutputFormat;

  let creditsCharged = false;

  try {
    const imageType = getImageType(currentJob.metadata);

    if (!imageType) {
      throw new Error("This image job is missing a valid image type.");
    }

    await spendImageGenerationCredits({
      supabase: input.supabase,
      userId: input.userId,
      projectId: currentJob.project_id || "",
      generatedImageId: currentJob.id,
      amount: currentJob.credits_spent,
      imageType,
    });
    creditsCharged = true;

    const { error: processingError } = await input.supabase
      .from("generated_images")
      .update({ status: "processing", error_message: null })
      .eq("id", currentJob.id)
      .eq("user_id", input.userId);

    if (processingError) {
      throw new Error(processingError.message);
    }

    const generated = await generateImageWithOpenAI({
      model: currentJob.model,
      prompt: currentJob.prompt,
      referenceImageUrl: await getProductReferenceImageUrl({
        recognitionId: getRecognitionId(currentJob.metadata),
        supabase: input.supabase,
        userId: input.userId,
      }),
      styleReferenceImageUrl:
        typeof currentJob.metadata?.style_reference_image_url === "string" &&
        URL.canParse(currentJob.metadata.style_reference_image_url)
          ? currentJob.metadata.style_reference_image_url
          : null,
      size,
      quality,
      outputFormat,
    });
    const extension = outputFormat === "jpeg" ? "jpg" : outputFormat;
    const storagePath = `${input.userId}/${currentJob.id}.${extension}`;
    const contentType =
      outputFormat === "jpeg" ? "image/jpeg" : `image/${outputFormat}`;
    const { error: uploadError } = await input.supabase.storage
      .from(currentJob.storage_bucket)
      .upload(storagePath, generated.bytes, {
        cacheControl: "31536000",
        contentType,
        upsert: true,
      });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const [width, height] = size.split("x").map(Number);
    const { data: completedJob, error: updateError } = await input.supabase
      .from("generated_images")
      .update({
        status: "completed",
        storage_path: storagePath,
        width,
        height,
        generation_params: {
          ...generationParams,
          size,
          quality,
          reference_image_mode: getRecognitionId(currentJob.metadata)
            ? "product_recognition"
            : "none",
          output_format: outputFormat,
          usage: generated.usage,
          revised_prompt: generated.revisedPrompt,
        },
      })
      .eq("id", currentJob.id)
      .eq("user_id", input.userId)
      .select(
        jobSelect,
      )
      .single();

    if (updateError) {
      throw new Error(updateError.message);
    }

    return withPublicUrl(input.supabase, completedJob as GeneratedImageJob);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Image generation failed.";

    await input.supabase
      .from("generated_images")
      .update({ status: "failed", credits_spent: 0, error_message: message })
      .eq("id", currentJob.id)
      .eq("user_id", input.userId);

    if (creditsCharged) {
      await refundImageGenerationCredits({
        supabase: input.supabase,
        userId: input.userId,
        projectId: currentJob.project_id || "",
        generatedImageId: currentJob.id,
        amount: currentJob.credits_spent,
        reason: message,
      });
    }

    throw new Error(message);
  }
}
