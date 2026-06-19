import { apiError, apiOk, handleApiError } from "@/lib/api-response";
import { regenerateImageGenerationJob } from "@/lib/image-generation/jobs";
import { getUserCreditBalance, InsufficientCreditsError } from "@/lib/credits";
import { supabaseServer } from "@/lib/supabaseClient";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = await supabaseServer();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return apiError({ code: "UNAUTHORIZED", status: 401 });
    }

    const job = await regenerateImageGenerationJob({
      supabase,
      userId: user.id,
      jobId: id,
    });
    const creditBalance = await getUserCreditBalance(supabase, user.id);

    return apiOk({ credit_balance: creditBalance, job });
  } catch (error) {
    if (error instanceof InsufficientCreditsError) {
      return apiError({
        code: "PAYMENT_REQUIRED",
        error,
        status: 402,
      });
    }

    return handleApiError(error, "Failed to regenerate image job.");
  }
}
