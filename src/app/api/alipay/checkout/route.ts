import { randomUUID } from "crypto";
import { NextResponse, type NextRequest } from "next/server";

import {
  alipayAmountToCents,
  createAlipayPagePayUrl,
  getAppUrl,
  getCreditPack,
  getCreditPackAmount,
} from "@/lib/alipay";
import {
  isSupabaseConfigured,
  supabaseServer,
  supabaseServiceRole,
} from "@/lib/supabaseClient";

function isValidAmount(amount: string | undefined) {
  return Boolean(amount && /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(amount));
}

export async function POST(request: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: "Supabase is not configured." },
        { status: 500 },
      );
    }

    const { pack: packCode } = (await request.json()) as { pack?: string };
    const pack = packCode ? getCreditPack(packCode) : null;

    if (!pack) {
      return NextResponse.json(
        { error: "Invalid credit pack." },
        { status: 400 },
      );
    }

    const supabase = await supabaseServer();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const amount = getCreditPackAmount(pack);

    if (!isValidAmount(amount)) {
      return NextResponse.json(
        { error: `Missing or invalid ${pack.amountEnvKey}.` },
        { status: 500 },
      );
    }

    const appUrl = getAppUrl(request.url);
    const outTradeNo = `credits_${Date.now()}_${randomUUID().replaceAll("-", "")}`;
    const adminSupabase = supabaseServiceRole();
    const { error: paymentError } = await adminSupabase.from("payments").insert({
      amount_cents: alipayAmountToCents(amount || "0"),
      credits_purchased: pack.credits,
      currency: "CNY",
      idempotency_key: `alipay:trade:${outTradeNo}`,
      provider: "alipay",
      provider_payment_id: outTradeNo,
      provider_payload: {
        out_trade_no: outTradeNo,
        pack: pack.code,
      },
      status: "pending",
      user_id: user.id,
    });

    if (paymentError) {
      throw new Error(paymentError.message);
    }

    const url = createAlipayPagePayUrl({
      amount: amount || "0",
      notifyUrl: `${appUrl}/api/alipay/notify`,
      outTradeNo,
      returnUrl: `${appUrl}/account?checkout=success`,
      subject: `${pack.name} ${pack.credits} Credits`,
    });

    return NextResponse.json({ url });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create Alipay checkout.",
      },
      { status: 500 },
    );
  }
}
