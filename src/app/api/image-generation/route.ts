import { NextResponse } from "next/server";

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
      return NextResponse.json({ error }, { status: 401 });
    }

    const url = new URL(request.url);
    const jobs = await listImageGenerationJobs(
      supabase,
      normalizeIds(url.searchParams.get("ids")),
    );

    return NextResponse.json({ jobs });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to list image jobs.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const { error, supabase, user } = await getAuthenticatedUser();

    if (error || !user) {
      return NextResponse.json({ error }, { status: 401 });
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
      return NextResponse.json(
        {
          error:
            "image_type must be main_image, lifestyle, infographic, or detail_page_module.",
        },
        { status: 400 },
      );
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

    return NextResponse.json({ credit_balance: creditBalance, job });
  } catch (error) {
    if (error instanceof InsufficientCreditsError) {
      return NextResponse.json({ error: error.message }, { status: 402 });
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to queue image job.",
      },
      { status: 500 },
    );
  }
}
