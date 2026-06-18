import { NextResponse, type NextRequest } from "next/server";

import { alipayAmountToCents, verifyAlipayNotification } from "@/lib/alipay";
import { supabaseServiceRole } from "@/lib/supabaseClient";

export const runtime = "nodejs";

function textResponse(text: "failure" | "success", status = 200) {
  return new NextResponse(text, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
    status,
  });
}

function paramsToRecord(params: URLSearchParams) {
  const record: Record<string, string> = {};

  params.forEach((value, key) => {
    record[key] = value;
  });

  return record;
}

function isPaidStatus(status: string | undefined) {
  return status === "TRADE_SUCCESS" || status === "TRADE_FINISHED";
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const params = paramsToRecord(new URLSearchParams(body));

    if (!verifyAlipayNotification(params)) {
      return textResponse("failure", 400);
    }

    if (params.app_id !== process.env.ALIPAY_APP_ID) {
      return textResponse("failure", 400);
    }

    const outTradeNo = params.out_trade_no;

    if (!outTradeNo) {
      return textResponse("failure", 400);
    }

    const supabase = supabaseServiceRole();

    if (!isPaidStatus(params.trade_status)) {
      if (params.trade_status === "TRADE_CLOSED") {
        const { error } = await supabase
          .from("payments")
          .update({
            provider_payload: params,
            status: "canceled",
          })
          .eq("provider", "alipay")
          .eq("provider_payment_id", outTradeNo);

        if (error) {
          throw new Error(error.message);
        }
      }

      return textResponse("success");
    }

    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .select("user_id,credits_purchased,amount_cents")
      .eq("provider", "alipay")
      .eq("provider_payment_id", outTradeNo)
      .maybeSingle();

    if (paymentError) {
      throw new Error(paymentError.message);
    }

    if (!payment) {
      return textResponse("failure", 404);
    }

    const paidAmountCents = alipayAmountToCents(params.total_amount || "0");

    if (paidAmountCents !== payment.amount_cents) {
      return textResponse("failure", 400);
    }

    const { error } = await supabase.rpc("grant_payment_credits", {
      p_amount_cents: paidAmountCents,
      p_credits: payment.credits_purchased,
      p_currency: "CNY",
      p_idempotency_key: `alipay:trade:${outTradeNo}`,
      p_provider_payload: params,
      p_provider_payment_id: outTradeNo,
      p_user_id: payment.user_id,
    });

    if (error) {
      throw new Error(error.message);
    }

    return textResponse("success");
  } catch (error) {
    console.error(error);

    return textResponse("failure", 500);
  }
}
