import { apiError, apiOk, handleApiError } from "@/lib/api-response";
import { processImageGenerationJob } from "@/lib/image-generation/jobs";
import { getUserCreditBalance, InsufficientCreditsError } from "@/lib/credits";
import { supabaseServer } from "@/lib/supabaseClient";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(_request: Request, context: RouteContext) {
  let supabase: Awaited<ReturnType<typeof supabaseServer>> | null = null;
  let userId: string | null = null;

  try {
    const { id } = await context.params;
    supabase = await supabaseServer();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return apiError({ code: "UNAUTHORIZED", status: 401 });
    }

    userId = user.id;
    const job = await processImageGenerationJob({
      supabase,
      userId: user.id,
      jobId: id,
    });
    const creditBalance = await getUserCreditBalance(supabase, user.id);

    return apiOk({ credit_balance: creditBalance, job });
  } catch (error) {
    const creditBalance = supabase && userId
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

    return handleApiError(error, "Failed to process image job.", {
      extra: { credit_balance: creditBalance },
    });
  }
}
