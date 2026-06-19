import { apiError, apiOk, handleApiError } from "@/lib/api-response";
import {
  listImageGenerationJobs,
  queueImageGenerationJob,
} from "@/lib/image-generation/jobs";
import { getUserCreditBalance, InsufficientCreditsError } from "@/lib/credits";
import { isGeneratedImageType } from "@/lib/image-generation/types";
import { supabaseServer } from "@/lib/supabaseClient";

function normalizeIds(value: string | null) {
  return (
    value
      ?.split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 20) || []
  );
}

async function getAuthenticatedUser() {
  const supabase = await supabaseServer();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { error: "Unauthorized.", supabase, user: null };
  }

  return { error: null, supabase, user };
}

export async function GET(request: Request) {
  try {
    const { error, supabase } = await getAuthenticatedUser();

    if (error) {
      return apiError({ code: "UNAUTHORIZED", message: error, status: 401 });
    }

    const url = new URL(request.url);
    const jobs = await listImageGenerationJobs(
      supabase,
      normalizeIds(url.searchParams.get("ids")),
    );

    return apiOk({ jobs });
  } catch (error) {
    return handleApiError(error, "Failed to list image jobs.");
  }
}

export async function POST(request: Request) {
  try {
    const { error, supabase, user } = await getAuthenticatedUser();

    if (error || !user) {
      return apiError({
        code: "UNAUTHORIZED",
        message: error || "Unauthorized.",
        status: 401,
      });
    }

    const body = (await request.json()) as Record<string, unknown>;
    const imageType = body.image_type;
    const prompt = typeof body.prompt === "string" ? body.prompt : "";
    const platform = typeof body.platform === "string" ? body.platform : "";
    const recognitionId =
      typeof body.recognition_id === "string" ? body.recognition_id : null;
    const moduleId =
      typeof body.module_id === "string" ? body.module_id : null;

    if (!isGeneratedImageType(imageType)) {
      return apiError({
        code: "BAD_REQUEST",
        message:
          "image_type must be main_image, lifestyle, infographic, or detail_page_module.",
        status: 400,
      });
    }

    const job = await queueImageGenerationJob({
      supabase,
      userId: user.id,
      imageType,
      prompt,
      platform,
      recognitionId,
      moduleId,
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

    return handleApiError(error, "Failed to queue image job.");
  }
}
