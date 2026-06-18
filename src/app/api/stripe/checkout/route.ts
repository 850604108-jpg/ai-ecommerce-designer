import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Stripe checkout is disabled. Use daily check-in credits instead." },
    { status: 410 },
  );
}
