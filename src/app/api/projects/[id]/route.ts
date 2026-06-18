import { NextResponse } from "next/server";

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
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const project = await softDeleteProject({
      supabase,
      userId: user.id,
      projectId: id,
    });

    return NextResponse.json({ project });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to delete project.",
      },
      { status: 500 },
    );
  }
}
