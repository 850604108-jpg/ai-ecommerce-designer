import type { NextRequest } from "next/server";

import { apiError, apiOk } from "@/lib/api-response";
import { validateDeploymentEnvironment } from "@/lib/env";
import { supabaseServiceRole } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const requiredDatabaseTables = [
  "users",
  "projects",
  "generated_images",
  "credits",
  "templates",
  "product_recognitions",
] as const;

async function checkDatabaseConnection() {
  const supabase = supabaseServiceRole();
  const results = await Promise.all(
    requiredDatabaseTables.map(async (table) => {
      const { error } = await supabase
        .from(table)
        .select("*", { count: "exact", head: true })
        .limit(1);

      return { error, table };
    }),
  );
  const failed = results.find(({ error }) => error);

  return {
    message: failed
      ? `${failed.table}: ${failed.error?.message || "Table check failed."}`
      : "Supabase database connection and required tables are reachable.",
    ok: !failed,
    scope: "database",
  };
}

export async function GET(request: NextRequest) {
  const token = process.env.HEALTHCHECK_TOKEN;

  if (token) {
    const authorization = request.headers.get("authorization");

    if (authorization !== `Bearer ${token}`) {
      return apiError({ code: "UNAUTHORIZED", status: 401 });
    }
  }

  const envResult = validateDeploymentEnvironment();
  const databaseCheck =
    envResult.failures.some((check) =>
      ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"].includes(
        check.key,
      ),
    )
      ? {
          message: "Skipped because Supabase server credentials are incomplete.",
          ok: false,
          scope: "database",
        }
      : await checkDatabaseConnection();
  const checks = [...envResult.checks, { key: "DATABASE_CONNECTION", ...databaseCheck }];
  const ok = checks.every((check) => check.ok);

  return apiOk(
    {
      checkedAt: new Date().toISOString(),
      checks,
      ok,
    },
    ok ? 200 : 503,
  );
}
