type EnvironmentCheck = {
  key: string;
  message: string;
  ok: boolean;
  scope: "credits" | "database" | "openai" | "supabase" | "vercel";
};

type EnvironmentCheckInput = {
  env?: NodeJS.ProcessEnv;
  nodeEnv?: string;
};

const requiredEnvKeys = [
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "OPENAI_API_KEY",
] as const;

export const deploymentEnvKeys = [
  ...requiredEnvKeys,
  "NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET",
  "OPENAI_IMAGE_MODEL",
  "OPENAI_VISION_MODEL",
  "OPENAI_PROMPT_ENGINE_MODEL",
  "OPENAI_PROMPT_ENGINE_ENABLED",
  "DAILY_CHECK_IN_CREDITS",
  "HEALTHCHECK_TOKEN",
] as const;

function hasValue(value: string | undefined) {
  return Boolean(value?.trim());
}

function canParseUrl(value: string | undefined) {
  return Boolean(value && URL.canParse(value));
}

function isLocalUrl(value: string | undefined) {
  if (!value || !URL.canParse(value)) {
    return false;
  }

  const { hostname, protocol } = new URL(value);

  return (
    protocol !== "https:" ||
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".local")
  );
}

function checkPrefix(value: string | undefined, prefixes: string[]) {
  return Boolean(value && prefixes.some((prefix) => value.startsWith(prefix)));
}

export function validateDeploymentEnvironment({
  env = process.env,
  nodeEnv = process.env.NODE_ENV,
}: EnvironmentCheckInput = {}) {
  const checks: EnvironmentCheck[] = [
    ...requiredEnvKeys.map((key) => ({
      key,
      message: `${key} is configured.`,
      ok: hasValue(env[key]),
      scope:
        key.includes("SUPABASE")
          ? key === "NEXT_PUBLIC_SUPABASE_URL"
            ? "database"
            : "supabase"
          : key.includes("OPENAI")
              ? "openai"
              : "vercel",
    }) satisfies EnvironmentCheck),
    {
      key: "NEXT_PUBLIC_APP_URL",
      message: "NEXT_PUBLIC_APP_URL must be a valid public HTTPS URL in production.",
      ok:
        canParseUrl(env.NEXT_PUBLIC_APP_URL) &&
        (nodeEnv !== "production" || !isLocalUrl(env.NEXT_PUBLIC_APP_URL)),
      scope: "vercel",
    },
    {
      key: "NEXT_PUBLIC_SUPABASE_URL",
      message: "NEXT_PUBLIC_SUPABASE_URL must be a valid Supabase project URL.",
      ok:
        canParseUrl(env.NEXT_PUBLIC_SUPABASE_URL) &&
        new URL(env.NEXT_PUBLIC_SUPABASE_URL || "https://example.com").hostname.endsWith(
          ".supabase.co",
        ),
      scope: "database",
    },
    {
      key: "OPENAI_API_KEY",
      message: "OPENAI_API_KEY should use an OpenAI project or user key prefix.",
      ok: checkPrefix(env.OPENAI_API_KEY, ["sk-", "sk-proj-"]),
      scope: "openai",
    },
    {
      key: "DAILY_CHECK_IN_CREDITS",
      message: "DAILY_CHECK_IN_CREDITS should be a positive integer when set.",
      ok:
        !hasValue(env.DAILY_CHECK_IN_CREDITS) ||
        /^[1-9]\d*$/.test(env.DAILY_CHECK_IN_CREDITS || ""),
      scope: "credits",
    },
  ];
  const failures = checks.filter((check) => !check.ok);

  return {
    checks,
    failures,
    ok: failures.length === 0,
  };
}
