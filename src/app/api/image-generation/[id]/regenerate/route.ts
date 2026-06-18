import { NextResponse } from "next/server";

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
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const job = await regenerateImageGenerationJob({
      supabase,
      userId: user.id,
      jobId: id,
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
          error instanceof Error
            ? error.message
            : "Failed to regenerate image job.",
      },
      { status: 500 },
    );
  }
}
