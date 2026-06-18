import { NextResponse } from "next/server";

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
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    userId = user.id;
    const job = await processImageGenerationJob({
      supabase,
      userId: user.id,
      jobId: id,
    });
    const creditBalance = await getUserCreditBalance(supabase, user.id);

    return NextResponse.json({ credit_balance: creditBalance, job });
  } catch (error) {
    const creditBalance = supabase && userId
      ? await getUserCreditBalance(supabase, userId).catch(() => null)
      : null;

    return NextResponse.json(
      {
        credit_balance: creditBalance,
        error:
          error instanceof Error
            ? error.message
            : "Failed to process image job.",
      },
      { status: error instanceof InsufficientCreditsError ? 402 : 500 },
    );
  }
}
