import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  return NextResponse.json(
    { error: "Alipay notify is disabled. Use daily check-in credits instead." },
    { status: 410 },
  );
}
