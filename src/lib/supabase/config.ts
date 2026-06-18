const placeholderValues = new Set([
  "https://your-project-ref.supabase.co",
  "your-supabase-anon-key",
  "your-supabase-service-role-key",
]);

export const productImagesBucket = "product-images";
export const generatedImagesBucket = "generated-images";
export const requiredStorageBuckets = [
  productImagesBucket,
  generatedImagesBucket,
] as const;

type SupabasePublicConfigInput = {
  anonKey?: string;
  url?: string;
};

function hasUsableValue(value: string | undefined) {
  const trimmedValue = value?.trim();

  return Boolean(trimmedValue) && !placeholderValues.has(trimmedValue || "");
}

export function isValidSupabaseUrl(value: string | undefined) {
  if (!hasUsableValue(value) || !URL.canParse(value || "")) {
    return false;
  }

  return new URL(value || "").hostname.endsWith(".supabase.co");
}

export function isSupabasePublicConfigComplete({
  anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  url = process.env.NEXT_PUBLIC_SUPABASE_URL,
}: SupabasePublicConfigInput = {}) {
  return isValidSupabaseUrl(url) && hasUsableValue(anonKey);
}

export function getSupabasePublicConfig() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!isSupabasePublicConfigComplete({ anonKey: supabaseAnonKey, url: supabaseUrl })) {
    throw new Error(
      "Missing or invalid NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  return { supabaseAnonKey: supabaseAnonKey || "", supabaseUrl: supabaseUrl || "" };
}

export function getSupabaseStorageBucket() {
  return process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || productImagesBucket;
}

export function isSupabaseServiceRoleConfigured() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  return (
    isValidSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    hasUsableValue(serviceRoleKey)
  );
}
