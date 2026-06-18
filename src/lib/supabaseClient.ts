import { createBrowserClient, createServerClient } from "@supabase/ssr";
import {
  createClient as createSupabaseClient,
  type SupabaseClient,
} from "@supabase/supabase-js";

import {
  getSupabasePublicConfig,
  isSupabasePublicConfigComplete,
  isSupabaseServiceRoleConfigured,
} from "@/lib/supabase/config";

export {
  getSupabasePublicConfig,
  getSupabaseStorageBucket,
  isSupabasePublicConfigComplete,
  isSupabaseServiceRoleConfigured,
} from "@/lib/supabase/config";

type SupabaseBrowserClient = ReturnType<typeof createBrowserClient>;
type SupabaseServiceRoleClient = SupabaseClient;

let browserClient: SupabaseBrowserClient | null = null;
let serviceRoleClient: SupabaseServiceRoleClient | null = null;

export function isSupabaseConfigured() {
  return isSupabasePublicConfigComplete();
}

export function supabaseBrowser() {
  if (typeof window === "undefined") {
    throw new Error("supabaseBrowser can only be used in the browser.");
  }

  if (!browserClient) {
    const { supabaseAnonKey, supabaseUrl } = getSupabasePublicConfig();
    browserClient = createBrowserClient(supabaseUrl, supabaseAnonKey);
  }

  return browserClient;
}

export async function supabaseServer() {
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  const { supabaseAnonKey, supabaseUrl } = getSupabasePublicConfig();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, options, value }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot set cookies. Route Handlers can refresh sessions.
        }
      },
    },
  });
}

export function supabaseServiceRole() {
  if (!serviceRoleClient) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!isSupabaseServiceRoleConfigured()) {
      throw new Error(
        "Missing or invalid NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.",
      );
    }

    serviceRoleClient = createSupabaseClient(supabaseUrl || "", serviceRoleKey || "", {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return serviceRoleClient;
}

export const createClient = supabaseServer;
export const createServiceRoleClient = supabaseServiceRole;
