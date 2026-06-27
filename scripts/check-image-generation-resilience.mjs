import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const imageOpenAI = readFileSync(
  join(root, "src/lib/image-generation/openai.ts"),
  "utf8",
);
const uploader = readFileSync(
  join(root, "src/components/image-uploader.tsx"),
  "utf8",
);

const requiredMarkers = [
  {
    content: imageOpenAI,
    marker: "OPENAI_IMAGE_GENERATION_TIMEOUT_MS",
    label: "Image generation has a configurable timeout",
  },
  {
    content: imageOpenAI,
    marker: "AbortController",
    label: "Image generation aborts slow OpenAI requests",
  },
  {
    content: imageOpenAI,
    marker: "signal: abortController.signal",
    label: "Image generation passes AbortSignal to OpenAI fetch",
  },
  {
    content: uploader,
    marker: "processQueuedImageJobWithRetry(job)",
    label: "Batch listing generation uses the retry wrapper",
  },
];

const missing = requiredMarkers.filter((item) => !item.content.includes(item.marker));

if (missing.length) {
  console.error("Image generation resilience guard failed:");
  for (const item of missing) {
    console.error(`- ${item.label}: missing "${item.marker}"`);
  }
  process.exit(1);
}

console.log("Image generation resilience guard passed.");
