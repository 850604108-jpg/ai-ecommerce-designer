import { NextResponse, type NextRequest } from "next/server";

import { supabaseServer, isSupabaseConfigured } from "@/lib/supabaseClient";

function safeNextPath(next: string) {
  return next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = safeNextPath(requestUrl.searchParams.get("next") ?? "/dashboard");

  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(
      new URL(
        "/login?error=Supabase%20is%20not%20configured.",
        request.url,
      ),
    );
  }

  if (code) {
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(new URL(next, request.url));
    }
  }

  return NextResponse.redirect(
    new URL("/login?error=Could%20not%20authenticate%20request.", request.url),
  );
}
