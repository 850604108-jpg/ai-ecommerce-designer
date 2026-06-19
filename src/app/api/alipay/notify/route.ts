import { apiError } from "@/lib/api-response";

export const runtime = "nodejs";

export async function POST() {
  return apiError({
    code: "BAD_REQUEST",
    message: "Alipay notify is disabled. Use daily check-in credits instead.",
    status: 410,
  });
}
