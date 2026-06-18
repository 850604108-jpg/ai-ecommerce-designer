import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Stripe checkout is disabled. Use Alipay checkout instead." },
    { status: 410 },
  );
}
