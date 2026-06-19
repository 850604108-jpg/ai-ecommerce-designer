import { apiError, apiOk, handleApiError } from "@/lib/api-response";
import { softDeleteProject } from "@/lib/projects";
import { supabaseServer } from "@/lib/supabaseClient";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = await supabaseServer();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return apiError({ code: "UNAUTHORIZED", status: 401 });
    }

    const project = await softDeleteProject({
      supabase,
      userId: user.id,
      projectId: id,
    });

    return apiOk({ project });
  } catch (error) {
    return handleApiError(error, "Failed to delete project.");
  }
}
