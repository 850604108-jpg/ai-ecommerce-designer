import { NextResponse } from "next/server";

import {
  getDailyCheckInStatus,
  grantDailyCheckInCredits,
} from "@/lib/credits";
import { supabaseServer } from "@/lib/supabaseClient";

async function getAuthenticatedUser() {
  const supabase = await supabaseServer();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { error: "Unauthorized.", user: null };
  }

  return { error: null, user };
}

export async function GET() {
  try {
    const { error, user } = await getAuthenticatedUser();

    if (error || !user) {
      return NextResponse.json({ error }, { status: 401 });
    }

    const status = await getDailyCheckInStatus(user.id);

    return NextResponse.json(status);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load check-in status.",
      },
      { status: 500 },
    );
  }
}

export async function POST() {
  try {
    const { error, user } = await getAuthenticatedUser();

    if (error || !user) {
      return NextResponse.json({ error }, { status: 401 });
    }

    const result = await grantDailyCheckInCredits(user.id);

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to complete daily check-in.",
      },
      { status: 500 },
    );
  }
}
