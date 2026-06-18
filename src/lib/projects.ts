import { supabaseServer } from "@/lib/supabaseClient";

type SupabaseClient = Awaited<ReturnType<typeof supabaseServer>>;

export type DashboardProject = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  image_count: number;
  latest_image_url: string | null;
};

function normalizeSearchTerm(value: string) {
  return value.trim().replace(/[%_,]/g, " ").replace(/\s+/g, " ").slice(0, 80);
}

function getPublicUrl(
  supabase: SupabaseClient,
  bucket: string | null,
  storagePath: string | null,
) {
  if (!bucket || !storagePath) {
    return null;
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(bucket).getPublicUrl(storagePath);

  return publicUrl;
}

export async function listDashboardProjects(input: {
  supabase: SupabaseClient;
  userId: string;
  search?: string;
  page?: number;
  pageSize?: number;
}) {
  const pageSize = Math.min(Math.max(input.pageSize || 6, 1), 24);
  const page = Math.max(input.page || 1, 1);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const search = normalizeSearchTerm(input.search || "");

  let query = input.supabase
    .from("projects")
    .select(
      "id,name,description,status,created_at,updated_at,archived_at",
      { count: "exact" },
    )
    .eq("user_id", input.userId)
    .neq("status", "archived");

  if (search) {
    query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
  }

  const { count, data, error } = await query
    .order("updated_at", { ascending: false })
    .range(from, to);

  if (error) {
    throw new Error(error.message);
  }

  const projects = data || [];
  const projectIds = projects.map((project) => project.id as string);
  const imageStats = new Map<
    string,
    { count: number; latest_image_url: string | null }
  >();

  if (projectIds.length) {
    const { data: images, error: imagesError } = await input.supabase
      .from("generated_images")
      .select("project_id,storage_bucket,storage_path,created_at")
      .eq("user_id", input.userId)
      .in("project_id", projectIds)
      .neq("status", "deleted")
      .order("created_at", { ascending: false })
      .limit(500);

    if (imagesError) {
      throw new Error(imagesError.message);
    }

    for (const image of images || []) {
      const projectId = image.project_id as string;
      const current = imageStats.get(projectId) || {
        count: 0,
        latest_image_url: null,
      };

      imageStats.set(projectId, {
        count: current.count + 1,
        latest_image_url:
          current.latest_image_url ||
          getPublicUrl(
            input.supabase,
            image.storage_bucket as string | null,
            image.storage_path as string | null,
          ),
      });
    }
  }

  return {
    page,
    pageCount: Math.max(Math.ceil((count || 0) / pageSize), 1),
    pageSize,
    projects: projects.map((project) => {
      const stats = imageStats.get(project.id as string);

      return {
        id: project.id as string,
        name: project.name as string,
        description: (project.description as string | null) || null,
        status: project.status as string,
        created_at: project.created_at as string,
        updated_at: project.updated_at as string,
        archived_at: (project.archived_at as string | null) || null,
        image_count: stats?.count || 0,
        latest_image_url: stats?.latest_image_url || null,
      };
    }) satisfies DashboardProject[],
    totalCount: count || 0,
  };
}

export async function softDeleteProject(input: {
  supabase: SupabaseClient;
  userId: string;
  projectId: string;
}) {
  const archivedAt = new Date().toISOString();

  const { data: project, error: projectError } = await input.supabase
    .from("projects")
    .update({
      archived_at: archivedAt,
      status: "archived",
    })
    .eq("id", input.projectId)
    .eq("user_id", input.userId)
    .neq("status", "archived")
    .select("id,name,status,archived_at")
    .single();

  if (projectError) {
    throw new Error(projectError.message);
  }

  const { error: imagesError } = await input.supabase
    .from("generated_images")
    .update({ status: "deleted", error_message: null })
    .eq("project_id", input.projectId)
    .eq("user_id", input.userId)
    .neq("status", "deleted");

  if (imagesError) {
    throw new Error(imagesError.message);
  }

  return project;
}
