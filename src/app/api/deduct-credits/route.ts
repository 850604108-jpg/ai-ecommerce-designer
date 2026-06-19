import { apiError, apiOk, handleApiError } from "@/lib/api-response";
import {
  deductImageGenerationCredits,
  getUserCreditBalance,
  InsufficientCreditsError,
} from "@/lib/credits";
import {
  isGeneratedImageType,
} from "@/lib/image-generation/types";
import { supabaseServer } from "@/lib/supabaseClient";

const deductibleImageTypes = ["main_image", "lifestyle", "infographic"] as const;
type DeductibleImageType = (typeof deductibleImageTypes)[number];

function isDeductibleImageType(value: unknown): value is DeductibleImageType {
  return (
    typeof value === "string" &&
    deductibleImageTypes.includes(value as DeductibleImageType)
  );
}

function getMetadataImageType(metadata: unknown) {
  if (!metadata || typeof metadata !== "object") {
    return null;
  }

  const imageType = (metadata as Record<string, unknown>).image_type;

  return isGeneratedImageType(imageType) ? imageType : null;
}

export async function POST(request: Request) {
  let supabase: Awaited<ReturnType<typeof supabaseServer>> | null = null;
  let userId: string | null = null;

  try {
    supabase = await supabaseServer();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return apiError({ code: "UNAUTHORIZED", status: 401 });
    }

    userId = user.id;
    const body = (await request.json()) as Record<string, unknown>;
    const imageType = body.image_type;
    const generatedImageId = body.generated_image_id;

    if (!isDeductibleImageType(imageType)) {
      return apiError({
        code: "BAD_REQUEST",
        message: "image_type must be main_image, lifestyle, or infographic.",
        status: 400,
      });
    }

    if (typeof generatedImageId !== "string" || !generatedImageId.trim()) {
      return apiError({
        code: "BAD_REQUEST",
        message: "generated_image_id is required.",
        status: 400,
      });
    }

    const { data: job, error: jobError } = await supabase
      .from("generated_images")
      .select("id,project_id,metadata,status")
      .eq("id", generatedImageId)
      .eq("user_id", user.id)
      .neq("status", "deleted")
      .single();

    if (jobError || !job) {
      return apiError({
        code: "BAD_REQUEST",
        message: "Image generation job not found.",
        status: 404,
      });
    }

    const jobImageType = getMetadataImageType(job.metadata);

    if (jobImageType && jobImageType !== imageType) {
      return apiError({
        code: "BAD_REQUEST",
        message: "image_type does not match the generation job.",
        status: 400,
      });
    }

    const result = await deductImageGenerationCredits({
      supabase,
      userId: user.id,
      projectId: job.project_id as string,
      generatedImageId: job.id as string,
      imageType,
    });

    return apiOk({
      credit_balance: result.creditBalance,
      credits_deducted: result.creditsDeducted,
      image_type: imageType,
    });
  } catch (error) {
    const creditBalance =
      supabase && userId
        ? await getUserCreditBalance(supabase, userId).catch(() => null)
        : null;

    if (error instanceof InsufficientCreditsError) {
      return apiError({
        code: "PAYMENT_REQUIRED",
        error,
        extra: { credit_balance: creditBalance },
        status: 402,
      });
    }

    return handleApiError(error, "Failed to deduct credits.", {
      extra: { credit_balance: creditBalance },
    });
  }
}
