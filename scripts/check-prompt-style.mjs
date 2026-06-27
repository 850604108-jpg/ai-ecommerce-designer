import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const files = [
  join(root, "src/lib/prompt-engine/index.ts"),
  join(root, "src/lib/prompt-engine/openai.ts"),
  join(root, "src/lib/prompt-engine/platforms.ts"),
];

const combined = files.map((file) => readFileSync(file, "utf8")).join("\n");
const requiredMarkers = [
  "平台视觉 DNA",
  "中国平台风格指纹",
  "移动端缩略图规则",
  "中国电商视觉硬要求",
  "角色版式配方",
  "中文文案策略",
  "产品还原硬规则",
  "platform_profile",
];

const missing = requiredMarkers.filter((marker) => !combined.includes(marker));

if (missing.length) {
  console.error(
    `Prompt style guard failed. Missing markers: ${missing.join(", ")}`,
  );
  process.exit(1);
}

console.log("Prompt style guard passed.");
