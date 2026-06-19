import { apiOk } from "@/lib/api-response";
import {
  isSupabasePublicConfigComplete,
  isSupabaseServiceRoleConfigured,
  requiredStorageBuckets,
} from "@/lib/supabase/config";
import { supabaseServiceRole } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type BucketStatus = {
  created: boolean;
  error: string | null;
  exists: boolean;
  name: string;
};

async function ensureStorageBuckets() {
  const supabase = supabaseServiceRole();
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();

  if (listError) {
    return requiredStorageBuckets.map(
      (name): BucketStatus => ({
        created: false,
        error: listError.message,
        exists: false,
        name,
      }),
    );
  }

  const existingBucketNames = new Set((buckets || []).map((bucket) => bucket.name));
  const statuses: BucketStatus[] = [];

  for (const name of requiredStorageBuckets) {
    if (existingBucketNames.has(name)) {
      statuses.push({ created: false, error: null, exists: true, name });
      continue;
    }

    const { error } = await supabase.storage.createBucket(name, {
      allowedMimeTypes: ["image/png", "image/jpeg", "image/webp"],
      fileSizeLimit: 10 * 1024 * 1024,
      public: true,
    });

    statuses.push({
      created: !error,
      error: error?.message || null,
      exists: !error,
      name,
    });
  }

  return statuses;
}

async function checkDatabaseConnection() {
  const supabase = supabaseServiceRole();
  const { error } = await supabase
    .from("users")
    .select("id", { count: "exact", head: true })
    .limit(1);

  return {
    error: error?.message || null,
    ok: !error,
  };
}

export async function GET() {
  const publicConfigOk = isSupabasePublicConfigComplete();
  const serviceRoleOk = isSupabaseServiceRoleConfigured();
  const status = {
    anonKeyConfigured: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    buckets: [] as BucketStatus[],
    checkedAt: new Date().toISOString(),
    database: {
      error: serviceRoleOk ? null : "Supabase service role credentials are missing or invalid.",
      ok: false,
    },
    serviceRoleConfigured: serviceRoleOk,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || null,
    supabaseUrlValid: publicConfigOk,
  };

  if (serviceRoleOk) {
    const [database, buckets] = await Promise.all([
      checkDatabaseConnection(),
      ensureStorageBuckets(),
    ]);

    status.database = database;
    status.buckets = buckets;
  }

  const connected =
    publicConfigOk &&
    serviceRoleOk &&
    status.database.ok &&
    status.buckets.every((bucket) => bucket.exists && !bucket.error);

  return apiOk(
    {
      connected,
      status,
    },
    connected ? 200 : 503,
  );
}
