import { apiError, apiOk, handleApiError } from "@/lib/api-response";
import { getUserCreditBalance } from "@/lib/credits";
import { supabaseServer } from "@/lib/supabaseClient";

export async function GET() {
  try {
    const supabase = await supabaseServer();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return apiError({ code: "UNAUTHORIZED", status: 401 });
    }

    const creditBalance = await getUserCreditBalance(supabase, user.id);

    return apiOk({ credit_balance: creditBalance });
  } catch (error) {
    return handleApiError(error, "Failed to load credit balance.");
  }
}
