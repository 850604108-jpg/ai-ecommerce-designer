import { apiError } from "@/lib/api-response";

export async function POST() {
  return apiError({
    code: "BAD_REQUEST",
    message: "Alipay checkout is disabled. Use daily check-in credits instead.",
    status: 410,
  });
}
