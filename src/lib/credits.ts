import { supabaseServer } from "@/lib/supabaseClient";
import {
  imageGenerationCreditCosts,
  type GeneratedImageType,
} from "@/lib/image-generation/types";

type SupabaseClient = Awaited<ReturnType<typeof supabaseServer>>;

export class InsufficientCreditsError extends Error {
  constructor(message = "积分不足，请充值后再生成。") {
    super(message);
    this.name = "InsufficientCreditsError";
  }
}

export function getImageGenerationCreditCost(imageType: GeneratedImageType) {
  return imageGenerationCreditCosts[imageType];
}

export async function getUserCreditBalance(
  supabase: SupabaseClient,
  userId: string,
) {
  const { data, error } = await supabase
    .from("user_credit_balances")
    .select("balance_after")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return Number(data?.balance_after || 0);
}

function isInsufficientCreditsError(error: { message?: string; code?: string }) {
  return (
    error.code === "P0001" &&
    typeof error.message === "string" &&
    error.message.includes("INSUFFICIENT_CREDITS")
  );
}

export async function spendImageGenerationCredits(input: {
  supabase: SupabaseClient;
  userId: string;
  projectId: string;
  generatedImageId: string;
  amount: number;
  imageType: GeneratedImageType;
}) {
  const { data, error } = await input.supabase.rpc(
    "spend_image_generation_credits",
    {
      p_amount: input.amount,
      p_generated_image_id: input.generatedImageId,
      p_image_type: input.imageType,
      p_project_id: input.projectId,
      p_user_id: input.userId,
    },
  );

  if (error) {
    if (isInsufficientCreditsError(error)) {
      throw new InsufficientCreditsError();
    }

    throw new Error(error.message);
  }

  return Number(data || 0);
}

export async function deductImageGenerationCredits(input: {
  supabase: SupabaseClient;
  userId: string;
  projectId: string;
  generatedImageId: string;
  imageType: GeneratedImageType;
}) {
  const amount = getImageGenerationCreditCost(input.imageType);
  const creditBalance = await spendImageGenerationCredits({
    ...input,
    amount,
  });

  return {
    creditBalance,
    creditsDeducted: amount,
  };
}

export async function refundImageGenerationCredits(input: {
  supabase: SupabaseClient;
  userId: string;
  projectId: string;
  generatedImageId: string;
  amount: number;
  reason: string;
}) {
  if (input.amount <= 0) {
    return getUserCreditBalance(input.supabase, input.userId);
  }

  const { data, error } = await input.supabase.rpc(
    "refund_image_generation_credits",
    {
      p_amount: input.amount,
      p_generated_image_id: input.generatedImageId,
      p_project_id: input.projectId,
      p_reason: input.reason,
      p_user_id: input.userId,
    },
  );

  if (error) {
    throw new Error(error.message);
  }

  return Number(data || 0);
}
