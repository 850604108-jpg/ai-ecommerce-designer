import { NextResponse } from "next/server";

import { getUserCreditBalance } from "@/lib/credits";
import { supabaseServer } from "@/lib/supabaseClient";

export async function GET() {
  try {
    const supabase = await supabaseServer();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const creditBalance = await getUserCreditBalance(supabase, user.id);

    return NextResponse.json({ credit_balance: creditBalance });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load credit balance.",
      },
      { status: 500 },
    );
  }
}
