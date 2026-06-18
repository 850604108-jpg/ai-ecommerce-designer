const required = [
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_STARTER_PRICE_ID",
  "STRIPE_GROWTH_PRICE_ID",
  "STRIPE_PRO_PRICE_ID",
  "OPENAI_API_KEY",
];

const optional = [
  "NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET",
  "OPENAI_IMAGE_MODEL",
  "OPENAI_VISION_MODEL",
  "HEALTHCHECK_TOKEN",
];

function ok(label) {
  console.log(`OK ${label}`);
}

function fail(label) {
  console.error(`FAIL ${label}`);
}

function hasValue(key) {
  return Boolean(process.env[key]?.trim());
}

function hasPrefix(key, prefixes) {
  const value = process.env[key] || "";

  return prefixes.some((prefix) => value.startsWith(prefix));
}

function canParseUrl(key) {
  return URL.canParse(process.env[key] || "");
}

const failures = [];

for (const key of required) {
  if (hasValue(key)) {
    ok(`${key} is set`);
  } else {
    failures.push(`${key} is missing`);
    fail(`${key} is missing`);
  }
}

for (const key of optional) {
  if (hasValue(key)) {
    ok(`${key} is set`);
  }
}

const shapeChecks = [
  ["NEXT_PUBLIC_APP_URL", canParseUrl("NEXT_PUBLIC_APP_URL"), "must be a valid URL"],
  [
    "NEXT_PUBLIC_SUPABASE_URL",
    canParseUrl("NEXT_PUBLIC_SUPABASE_URL") &&
      new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "https://example.com").hostname.endsWith(
        ".supabase.co",
      ),
    "must be a Supabase project URL",
  ],
  ["STRIPE_SECRET_KEY", hasPrefix("STRIPE_SECRET_KEY", ["sk_live_", "sk_test_"]), "must start with sk_live_ or sk_test_"],
  ["STRIPE_WEBHOOK_SECRET", hasPrefix("STRIPE_WEBHOOK_SECRET", ["whsec_"]), "must start with whsec_"],
  ["STRIPE_STARTER_PRICE_ID", hasPrefix("STRIPE_STARTER_PRICE_ID", ["price_"]), "must start with price_"],
  ["STRIPE_GROWTH_PRICE_ID", hasPrefix("STRIPE_GROWTH_PRICE_ID", ["price_"]), "must start with price_"],
  ["STRIPE_PRO_PRICE_ID", hasPrefix("STRIPE_PRO_PRICE_ID", ["price_"]), "must start with price_"],
  ["OPENAI_API_KEY", hasPrefix("OPENAI_API_KEY", ["sk-", "sk-proj-"]), "must start with sk- or sk-proj-"],
];

for (const [key, passed, message] of shapeChecks) {
  if (passed) {
    ok(`${key} shape is valid`);
  } else {
    failures.push(`${key} ${message}`);
    fail(`${key} ${message}`);
  }
}

if (failures.length) {
  console.error("\nDeployment check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("\nDeployment environment check passed.");
