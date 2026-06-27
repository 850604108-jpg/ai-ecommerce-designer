import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const openAIClient = readFileSync(
  join(root, "src/lib/openai/client.ts"),
  "utf8",
);
const promptOpenAI = readFileSync(
  join(root, "src/lib/prompt-engine/openai.ts"),
  "utf8",
);
const promptRoute = readFileSync(
  join(root, "src/app/api/prompt-engine/route.ts"),
  "utf8",
);

const requiredMarkers = [
  {
    content: openAIClient,
    marker: "signal?: AbortSignal",
    label: "OpenAI fetch accepts AbortSignal",
  },
  {
    content: openAIClient,
    marker: "signal: input.signal",
    label: "OpenAI fetch passes AbortSignal to fetch",
  },
  {
    content: promptOpenAI,
    marker: "OPENAI_PROMPT_ENGINE_TIMEOUT_MS",
    label: "Prompt enhancement has a configurable timeout",
  },
  {
    content: promptOpenAI,
    marker: "AbortController",
    label: "Prompt enhancement aborts slow OpenAI requests",
  },
  {
    content: promptRoute,
    marker: "promptEnhancementWarning",
    label: "Prompt route falls back with warning",
  },
];

const missing = requiredMarkers.filter((item) => !item.content.includes(item.marker));

if (missing.length) {
  console.error("Prompt timeout guard failed:");
  for (const item of missing) {
    console.error(`- ${item.label}: missing "${item.marker}"`);
  }
  process.exit(1);
}

console.log("Prompt timeout guard passed.");
