import { apiError, apiOk, handleApiError } from "@/lib/api-response";
import {
  getUserCreditBalance,
  InsufficientCreditsError,
  promptGenerationCreditCost,
  spendPromptGenerationCredits,
} from "@/lib/credits";
import {
  ecommercePlatforms,
  generatePromptSet,
  getPlatformProfile,
  isEcommercePlatform,
  type ListingImageRole,
  type PromptEngineInput,
} from "@/lib/prompt-engine";
import { enhancePromptSetWithOpenAI } from "@/lib/prompt-engine/openai";
import { supabaseServer } from "@/lib/supabaseClient";

function normalizeBody(value: unknown): PromptEngineInput {
  const record =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};

  return {
    product_name:
      typeof record.product_name === "string" ? record.product_name : "",
    category: typeof record.category === "string" ? record.category : "",
    highlights: Array.isArray(record.highlights)
      ? record.highlights.filter((item): item is string => typeof item === "string")
      : [],
  };
}

function normalizeMainImageCount(value: unknown) {
  const count = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(count)) {
    return 1;
  }

  return Math.min(Math.max(Math.floor(count), 1), 8);
}

function normalizeListingImageCount(value: unknown) {
  const count = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(count)) {
    return 5;
  }

  return Math.min(Math.max(Math.floor(count), 1), 7);
}

const listingImageRoles = new Set([
  "benefit",
  "feature",
  "dimension",
  "lifestyle",
  "detail",
  "comparison",
  "how_to_use",
  "package",
]);

function normalizeListingImageRoles(value: unknown): ListingImageRole[] {
  return Array.isArray(value)
    ? value.filter((item): item is ListingImageRole =>
        typeof item === "string" && listingImageRoles.has(item),
      )
    : [];
}

function normalizeReferenceInfluence(value: unknown) {
  const amount = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(amount)) {
    return 30;
  }

  return Math.min(Math.max(Math.floor(amount), 0), 80);
}

function normalizeGenerationMode(value: unknown) {
  return value === "detail" ? "detail" : "main";
}

function normalizeDetailGenerationMode(value: unknown) {
  return value === "long" ? "long" : "modules";
}

function normalizeDetailModuleId(value: unknown, fallback: string) {
  return typeof value === "string" && /^AD-0[1-7]$/.test(value)
    ? value
    : fallback;
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
    const currentBalance = await getUserCreditBalance(supabase, user.id);

    if (currentBalance < promptGenerationCreditCost) {
      throw new InsufficientCreditsError();
    }

    const body = (await request.json()) as Record<string, unknown>;
    const platform = isEcommercePlatform(body.platform)
      ? body.platform
      : undefined;

    const input = normalizeBody(body);
    const customRequirement =
      typeof body.custom_requirement === "string" ? body.custom_requirement : "";
    const mainImageCount = normalizeMainImageCount(body.main_image_count);
    const listingImageCount = normalizeListingImageCount(
      body.listing_image_count || body.main_image_count,
    );
    const listingImageRoles = normalizeListingImageRoles(
      body.listing_image_roles,
    );
    const referenceImageNotes =
      typeof body.reference_image_notes === "string"
        ? body.reference_image_notes
        : "";
    const referenceInfluence = normalizeReferenceInfluence(
      body.reference_influence,
    );
    const generationMode = normalizeGenerationMode(body.generation_mode);
    const detailGenerationMode = normalizeDetailGenerationMode(
      body.detail_generation_mode,
    );
    const detailStartId = normalizeDetailModuleId(body.detail_start_id, "AD-01");
    const detailEndId = normalizeDetailModuleId(body.detail_end_id, "AD-06");
    const resolvedPlatform = platform || "taobao";
    const deterministicPrompts = generatePromptSet(input, {
      detailEndId,
      detailGenerationMode,
      detailStartId,
      customRequirement,
      generationMode,
      listingImageCount,
      listingImageRoles,
      mainImageCount,
      platform,
      referenceImageNotes,
      referenceInfluence,
    });
    let promptEnhancementWarning = "";
    const prompts =
      process.env.OPENAI_PROMPT_ENGINE_ENABLED === "false"
        ? deterministicPrompts
        : await enhancePromptSetWithOpenAI({
            product: input,
            platformLabel: getPlatformProfile(resolvedPlatform).label,
            prompts: deterministicPrompts,
          }).catch((enhanceError) => {
            promptEnhancementWarning =
              enhanceError instanceof Error
                ? enhanceError.message
                : "Prompt enhancement failed.";

            return deterministicPrompts;
          });
    const creditBalance = await spendPromptGenerationCredits({
      metadata: {
        category: input.category,
        detail_end_id: detailEndId,
        detail_generation_mode: detailGenerationMode,
        detail_start_id: detailStartId,
        custom_requirement: customRequirement,
        generation_mode: generationMode,
        listing_image_count: listingImageCount,
        main_image_count: mainImageCount,
        platform: resolvedPlatform,
        product_name: input.product_name,
        reference_influence: referenceInfluence,
      },
      userId: user.id,
    });

    return apiOk({
      credit_balance: creditBalance,
      credits_deducted: promptGenerationCreditCost,
      platform: resolvedPlatform,
      prompt_enhancement_warning: promptEnhancementWarning || null,
      supportedPlatforms: ecommercePlatforms,
      prompts,
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

    return handleApiError(error, "Prompt generation failed.", { status: 400 });
  }
}
