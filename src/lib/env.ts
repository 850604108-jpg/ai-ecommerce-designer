type EnvironmentCheck = {
  key: string;
  message: string;
  ok: boolean;
  scope: "alipay" | "database" | "openai" | "supabase" | "vercel";
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
  "ALIPAY_APP_ID",
  "ALIPAY_PRIVATE_KEY",
  "ALIPAY_PUBLIC_KEY",
  "ALIPAY_STARTER_AMOUNT",
  "ALIPAY_GROWTH_AMOUNT",
  "ALIPAY_PRO_AMOUNT",
  "OPENAI_API_KEY",
] as const;

export const deploymentEnvKeys = [
  ...requiredEnvKeys,
  "NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET",
  "OPENAI_IMAGE_MODEL",
  "OPENAI_VISION_MODEL",
  "OPENAI_PROMPT_ENGINE_MODEL",
  "OPENAI_PROMPT_ENGINE_ENABLED",
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

function isMoneyAmount(value: string | undefined) {
  return Boolean(value && /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(value));
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
          : key.includes("ALIPAY")
            ? "alipay"
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
      key: "ALIPAY_APP_ID",
      message: "ALIPAY_APP_ID is configured.",
      ok: hasValue(env.ALIPAY_APP_ID),
      scope: "alipay",
    },
    {
      key: "ALIPAY_PRIVATE_KEY",
      message: "ALIPAY_PRIVATE_KEY is configured.",
      ok: hasValue(env.ALIPAY_PRIVATE_KEY),
      scope: "alipay",
    },
    {
      key: "ALIPAY_PUBLIC_KEY",
      message: "ALIPAY_PUBLIC_KEY is configured.",
      ok: hasValue(env.ALIPAY_PUBLIC_KEY),
      scope: "alipay",
    },
    ...(["ALIPAY_STARTER_AMOUNT", "ALIPAY_GROWTH_AMOUNT", "ALIPAY_PRO_AMOUNT"] as const).map(
      (key) => ({
        key,
        message: `${key} should be a valid CNY amount.`,
        ok: isMoneyAmount(env[key]),
        scope: "alipay",
      }) satisfies EnvironmentCheck,
    ),
    {
      key: "OPENAI_API_KEY",
      message: "OPENAI_API_KEY should use an OpenAI project or user key prefix.",
      ok: checkPrefix(env.OPENAI_API_KEY, ["sk-", "sk-proj-"]),
      scope: "openai",
    },
  ];
  const failures = checks.filter((check) => !check.ok);

  return {
    checks,
    failures,
    ok: failures.length === 0,
  };
}
