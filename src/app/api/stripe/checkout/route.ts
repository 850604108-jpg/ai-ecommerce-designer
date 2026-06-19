import { apiError } from "@/lib/api-response";

export async function POST() {
  return apiError({
    code: "BAD_REQUEST",
    message: "Stripe checkout is disabled. Use daily check-in credits instead.",
    status: 410,
  });
}
