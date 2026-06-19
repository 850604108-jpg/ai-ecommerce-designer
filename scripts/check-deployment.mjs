import { existsSync, readFileSync } from "node:fs";

function loadEnvFile(path) {
  if (!existsSync(path)) {
    return;
  }

  const content = readFileSync(path, "utf8");

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    const rawValue = trimmed.slice(index + 1).trim();
    const value = rawValue
      .replace(/^['"]|['"]$/g, "")
      .replace(/\\n/g, "\n");

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const required = [
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "OPENAI_API_KEY",
];

const optional = [
  "NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET",
  "OPENAI_IMAGE_MODEL",
  "OPENAI_VISION_MODEL",
  "OPENAI_PROMPT_ENGINE_MODEL",
  "OPENAI_PROMPT_ENGINE_ENABLED",
  "DAILY_CHECK_IN_CREDITS",
  "HEALTHCHECK_TOKEN",
];

function ok(label) {
  console.log(`OK ${label}`);
}

function fail(label) {
  console.error(`FAIL ${label}`);
}

function warn(label) {
  console.warn(`WARN ${label}`);
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
const warnings = [];

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

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
  ["OPENAI_API_KEY", hasPrefix("OPENAI_API_KEY", ["sk-", "sk-proj-"]), "must start with sk- or sk-proj-"],
];

if (
  hasValue("DAILY_CHECK_IN_CREDITS") &&
  !/^[1-9]\d*$/.test(process.env.DAILY_CHECK_IN_CREDITS || "")
) {
  shapeChecks.push([
    "DAILY_CHECK_IN_CREDITS",
    false,
    "must be a positive integer",
  ]);
}

for (const [key, passed, message] of shapeChecks) {
  if (passed) {
    ok(`${key} shape is valid`);
  } else {
    failures.push(`${key} ${message}`);
    fail(`${key} ${message}`);
  }
}

if (hasValue("NEXT_PUBLIC_APP_URL") && canParseUrl("NEXT_PUBLIC_APP_URL")) {
  const appUrl = new URL(process.env.NEXT_PUBLIC_APP_URL);

  if (appUrl.protocol !== "https:" && appUrl.hostname !== "localhost") {
    warnings.push("NEXT_PUBLIC_APP_URL should use https in Vercel production");
    warn("NEXT_PUBLIC_APP_URL should use https in Vercel production");
  }
}

const packageJson = existsSync("package.json") ? readJson("package.json") : null;
const requiredScripts = ["build", "lint", "typecheck", "check:deployment"];

if (!packageJson) {
  failures.push("package.json is missing");
  fail("package.json is missing");
} else {
  for (const script of requiredScripts) {
    if (packageJson.scripts?.[script]) {
      ok(`npm script ${script} is present`);
    } else {
      failures.push(`npm script ${script} is missing`);
      fail(`npm script ${script} is missing`);
    }
  }

  if (packageJson.dependencies?.next) {
    ok("Next.js dependency is present");
  } else {
    failures.push("Next.js dependency is missing");
    fail("Next.js dependency is missing");
  }
}

if (existsSync("next.config.ts") || existsSync("next.config.js")) {
  ok("Next config is present");
} else {
  failures.push("next.config is missing");
  fail("next.config is missing");
}

if (failures.length) {
  console.error("\nDeployment check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

if (warnings.length) {
  console.warn("\nDeployment warnings:");
  for (const warning of warnings) {
    console.warn(`- ${warning}`);
  }
}

console.log("\nDeployment environment check passed.");
