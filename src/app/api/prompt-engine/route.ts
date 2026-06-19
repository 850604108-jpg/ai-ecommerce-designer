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
    const resolvedPlatform = platform || "taobao";
    const deterministicPrompts = generatePromptSet(input, { platform });
    const prompts =
      process.env.OPENAI_PROMPT_ENGINE_ENABLED === "false"
        ? deterministicPrompts
        : await enhancePromptSetWithOpenAI({
            product: input,
            platformLabel: getPlatformProfile(resolvedPlatform).label,
            prompts: deterministicPrompts,
          });
    const creditBalance = await spendPromptGenerationCredits({
      metadata: {
        category: input.category,
        platform: resolvedPlatform,
        product_name: input.product_name,
      },
      userId: user.id,
    });

    return apiOk({
      credit_balance: creditBalance,
      credits_deducted: promptGenerationCreditCost,
      platform: resolvedPlatform,
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
