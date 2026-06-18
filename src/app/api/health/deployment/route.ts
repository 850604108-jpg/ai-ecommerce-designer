import { NextResponse, type NextRequest } from "next/server";

import { validateDeploymentEnvironment } from "@/lib/env";
import { supabaseServiceRole } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function checkDatabaseConnection() {
  const supabase = supabaseServiceRole();
  const { error } = await supabase
    .from("users")
    .select("id", { count: "exact", head: true })
    .limit(1);

  return {
    message: error ? error.message : "Supabase database connection is reachable.",
    ok: !error,
    scope: "database",
  };
}

export async function GET(request: NextRequest) {
  const token = process.env.HEALTHCHECK_TOKEN;

  if (token) {
    const authorization = request.headers.get("authorization");

    if (authorization !== `Bearer ${token}`) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
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

  return NextResponse.json(
    {
      checkedAt: new Date().toISOString(),
      checks,
      ok,
    },
    { status: ok ? 200 : 503 },
  );
}
