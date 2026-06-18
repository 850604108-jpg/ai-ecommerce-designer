import { supabaseServer } from "@/lib/supabaseClient";
import { supabaseServiceRole } from "@/lib/supabaseClient";
import {
  imageGenerationCreditCosts,
  type GeneratedImageType,
} from "@/lib/image-generation/types";

type SupabaseClient = Awaited<ReturnType<typeof supabaseServer>>;

export const dailyCheckInCredits = Math.max(
  Number.parseInt(process.env.DAILY_CHECK_IN_CREDITS || "10", 10) || 10,
  1,
);

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

export function getDailyCheckInDateKey(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Shanghai",
    year: "numeric",
  });

  return formatter.format(date);
}

export function getDailyCheckInIdempotencyKey(userId: string, dateKey: string) {
  return `daily-check-in:${userId}:${dateKey}`;
}

export async function getDailyCheckInStatus(userId: string) {
  const supabase = supabaseServiceRole();
  const dateKey = getDailyCheckInDateKey();
  const idempotencyKey = getDailyCheckInIdempotencyKey(userId, dateKey);
  const { data, error } = await supabase
    .from("credits")
    .select("amount,balance_after,created_at")
    .eq("user_id", userId)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return {
    amount: Number(data?.amount || dailyCheckInCredits),
    checkedIn: Boolean(data),
    checkedInAt: data?.created_at || null,
    creditBalance: typeof data?.balance_after === "number" ? data.balance_after : null,
    dateKey,
  };
}

export async function grantDailyCheckInCredits(userId: string) {
  const supabase = supabaseServiceRole();
  const dateKey = getDailyCheckInDateKey();
  const idempotencyKey = getDailyCheckInIdempotencyKey(userId, dateKey);
  const existingStatus = await getDailyCheckInStatus(userId);

  if (existingStatus.checkedIn) {
    return {
      ...existingStatus,
      alreadyCheckedIn: true,
      creditsGranted: 0,
    };
  }

  const { data: balanceRow, error: balanceError } = await supabase
    .from("user_credit_balances")
    .select("balance_after")
    .eq("user_id", userId)
    .maybeSingle();

  if (balanceError) {
    throw new Error(balanceError.message);
  }

  const currentBalance = Number(balanceRow?.balance_after || 0);
  const nextBalance = currentBalance + dailyCheckInCredits;
  const { data, error } = await supabase
    .from("credits")
    .insert({
      amount: dailyCheckInCredits,
      balance_after: nextBalance,
      idempotency_key: idempotencyKey,
      metadata: {
        date: dateKey,
        source: "daily_check_in",
      },
      transaction_type: "grant",
      user_id: userId,
    })
    .select("amount,balance_after,created_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      const status = await getDailyCheckInStatus(userId);

      return {
        ...status,
        alreadyCheckedIn: true,
        creditsGranted: 0,
      };
    }

    throw new Error(error.message);
  }

  return {
    alreadyCheckedIn: false,
    amount: Number(data.amount || dailyCheckInCredits),
    checkedIn: true,
    checkedInAt: data.created_at,
    creditBalance: Number(data.balance_after || nextBalance),
    creditsGranted: dailyCheckInCredits,
    dateKey,
  };
}
