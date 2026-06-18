import {
  defaultOpenAIPromptModel,
  getOpenAIResponseText,
  openAIFetch,
  type OpenAIResponsesPayload,
} from "@/lib/openai/client";

import type { PromptEngineInput, PromptEngineOutput } from "./types";

const promptEngineSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "mainImagePrompt",
    "lifestylePrompt",
    "infographicPrompt",
    "detailPagePrompt",
    "detailPageModules",
  ],
  properties: {
    mainImagePrompt: { type: "string" },
    lifestylePrompt: { type: "string" },
    infographicPrompt: { type: "string" },
    detailPagePrompt: { type: "string" },
    detailPageModules: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "title", "description", "imagePrompt"],
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          description: { type: "string" },
          imagePrompt: { type: "string" },
        },
      },
    },
  },
} as const;

function coercePromptOutput(value: unknown, fallback: PromptEngineOutput) {
  const record =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};

  const detailPageModules = Array.isArray(record.detailPageModules)
    ? record.detailPageModules
        .map((item, index) => {
          const moduleRecord =
            item && typeof item === "object"
              ? (item as Record<string, unknown>)
              : {};
          const fallbackModule = fallback.detailPageModules[index];

          return {
            id:
              typeof moduleRecord.id === "string"
                ? moduleRecord.id
                : fallbackModule?.id || `AD-${String(index + 1).padStart(2, "0")}`,
            title:
              typeof moduleRecord.title === "string"
                ? moduleRecord.title
                : fallbackModule?.title || "",
            description:
              typeof moduleRecord.description === "string"
                ? moduleRecord.description
                : fallbackModule?.description || "",
            imagePrompt:
              typeof moduleRecord.imagePrompt === "string"
                ? moduleRecord.imagePrompt
                : fallbackModule?.imagePrompt || "",
          };
        })
        .filter((item) => item.imagePrompt.trim())
    : fallback.detailPageModules;

  return {
    mainImagePrompt:
      typeof record.mainImagePrompt === "string"
        ? record.mainImagePrompt
        : fallback.mainImagePrompt,
    lifestylePrompt:
      typeof record.lifestylePrompt === "string"
        ? record.lifestylePrompt
        : fallback.lifestylePrompt,
    infographicPrompt:
      typeof record.infographicPrompt === "string"
        ? record.infographicPrompt
        : fallback.infographicPrompt,
    detailPagePrompt:
      typeof record.detailPagePrompt === "string"
        ? record.detailPagePrompt
        : fallback.detailPagePrompt,
    detailPageModules: detailPageModules.length
      ? detailPageModules
      : fallback.detailPageModules,
  } satisfies PromptEngineOutput;
}

export async function enhancePromptSetWithOpenAI(input: {
  product: PromptEngineInput;
  platformLabel: string;
  prompts: PromptEngineOutput;
}) {
  const payload = await openAIFetch<OpenAIResponsesPayload>("responses", {
    model: defaultOpenAIPromptModel,
    input: [
      {
        role: "system",
        content:
          "You are an ecommerce image prompt engine. Improve the supplied prompts for GPT Image API generation while preserving product truth, platform rules, JSON keys, and module count. Do not invent specs, certifications, prices, brands, or claims that were not provided.",
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: JSON.stringify({
              task: "Optimize these ecommerce image prompts for OpenAI GPT Image generation.",
              platform: input.platformLabel,
              product: input.product,
              prompts: input.prompts,
            }),
          },
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "ecommerce_prompt_engine_output",
        strict: true,
        schema: promptEngineSchema,
      },
    },
  });

  return coercePromptOutput(JSON.parse(getOpenAIResponseText(payload)), input.prompts);
}
