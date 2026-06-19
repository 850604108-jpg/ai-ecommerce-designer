import { apiError, apiOk, handleApiError } from "@/lib/api-response";
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
      return apiError({
        code: "UNAUTHORIZED",
        message: error || "Unauthorized.",
        status: 401,
      });
    }

    const status = await getDailyCheckInStatus(user.id);

    return apiOk(status);
  } catch (error) {
    return handleApiError(error, "Failed to load check-in status.");
  }
}

export async function POST() {
  try {
    const { error, user } = await getAuthenticatedUser();

    if (error || !user) {
      return apiError({
        code: "UNAUTHORIZED",
        message: error || "Unauthorized.",
        status: 401,
      });
    }

    const result = await grantDailyCheckInCredits(user.id);

    return apiOk(result);
  } catch (error) {
    return handleApiError(error, "Failed to complete daily check-in.");
  }
}
