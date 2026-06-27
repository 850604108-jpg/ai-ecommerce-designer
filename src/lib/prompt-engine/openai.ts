import {
  defaultOpenAIPromptModel,
  getOpenAIResponseText,
  openAIFetch,
  type OpenAIResponsesPayload,
} from "@/lib/openai/client";

import type {
  ListingImageRole,
  PlatformPromptProfile,
  PromptEngineInput,
  PromptEngineOutput,
} from "./types";

const listingImageRoles = [
  "benefit",
  "feature",
  "dimension",
  "lifestyle",
  "detail",
  "comparison",
  "how_to_use",
  "package",
] as const;

function getPromptEnhancementTimeoutMs() {
  const parsed = Number.parseInt(
    process.env.OPENAI_PROMPT_ENGINE_TIMEOUT_MS || "",
    10,
  );

  return Number.isFinite(parsed)
    ? Math.min(Math.max(parsed, 5000), 120_000)
    : 20_000;
}

const promptEngineSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "mainImagePrompt",
    "mainImagePrompts",
    "listingImagePrompts",
    "lifestylePrompt",
    "infographicPrompt",
    "detailPagePrompt",
    "detailPageModules",
  ],
  properties: {
    mainImagePrompt: { type: "string" },
    mainImagePrompts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "title", "prompt"],
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          prompt: { type: "string" },
        },
      },
    },
    listingImagePrompts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "role", "title", "prompt"],
        properties: {
          id: { type: "string" },
          role: { type: "string" },
          title: { type: "string" },
          prompt: { type: "string" },
        },
      },
    },
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
  const mainImagePrompts = Array.isArray(record.mainImagePrompts)
    ? record.mainImagePrompts
        .map((item, index) => {
          const promptRecord =
            item && typeof item === "object"
              ? (item as Record<string, unknown>)
              : {};
          const fallbackPrompt = fallback.mainImagePrompts[index];

          return {
            id:
              typeof promptRecord.id === "string"
                ? promptRecord.id
                : fallbackPrompt?.id || `AS-${String(index + 1).padStart(2, "0")}`,
            title:
              typeof promptRecord.title === "string"
                ? promptRecord.title
                : fallbackPrompt?.title || "",
            prompt:
              typeof promptRecord.prompt === "string"
                ? promptRecord.prompt
                : fallbackPrompt?.prompt || "",
          };
        })
        .filter((item) => item.prompt.trim())
    : fallback.mainImagePrompts;
  const listingImagePrompts = Array.isArray(record.listingImagePrompts)
    ? record.listingImagePrompts
        .map((item, index) => {
          const promptRecord =
            item && typeof item === "object"
              ? (item as Record<string, unknown>)
              : {};
          const fallbackPrompt = fallback.listingImagePrompts[index];

          return {
            id:
              typeof promptRecord.id === "string"
                ? promptRecord.id
                : fallbackPrompt?.id || `AS-${String(index + 1).padStart(2, "0")}`,
            prompt:
              typeof promptRecord.prompt === "string"
                ? promptRecord.prompt
                : fallbackPrompt?.prompt || "",
            role:
              typeof promptRecord.role === "string" &&
              listingImageRoles.includes(promptRecord.role as ListingImageRole)
                ? (promptRecord.role as ListingImageRole)
                : fallbackPrompt?.role || "benefit",
            title:
              typeof promptRecord.title === "string"
                ? promptRecord.title
                : fallbackPrompt?.title || "",
          };
        })
        .filter((item) => item.prompt.trim())
    : fallback.listingImagePrompts;

  return {
    mainImagePrompt:
      typeof record.mainImagePrompt === "string"
        ? record.mainImagePrompt
        : fallback.mainImagePrompt,
    mainImagePrompts: mainImagePrompts.length
      ? mainImagePrompts
      : fallback.mainImagePrompts,
    listingImagePrompts: listingImagePrompts.length
      ? listingImagePrompts
      : fallback.listingImagePrompts,
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
  platformProfile: PlatformPromptProfile;
  prompts: PromptEngineOutput;
}) {
  const abortController = new AbortController();
  const timeout = setTimeout(
    () => abortController.abort(),
    getPromptEnhancementTimeoutMs(),
  );

  try {
    const payload = await openAIFetch<OpenAIResponsesPayload>(
      "responses",
      {
        model: defaultOpenAIPromptModel,
        input: [
          {
            role: "system",
            content:
              "You are an ecommerce image prompt engine for Chinese marketplaces. Improve the supplied prompts for GPT Image API generation while preserving product truth, platform visual DNA, JSON keys, item order, AS/AD ids, and module count. Every AS prompt must feel native to the selected Chinese platform, not like a generic Amazon template. Keep explicit platform visual DNA, mobile thumbnail rules, Chinese short-copy strategy, role-specific layout formula, and product fidelity hard rules inside the prompt text. Interpret any short user requirement as actionable visual constraints, integrate it into every relevant image prompt, and do not merely copy it as visible text unless explicitly requested. Do not invent specs, certifications, prices, brands, accessories, packaging text, or claims that were not provided.",
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: JSON.stringify({
                  task: "Optimize these ecommerce image prompts for OpenAI GPT Image generation.",
                  platform: input.platformLabel,
                  platform_profile: input.platformProfile,
                  product: input.product,
                  prompts: input.prompts,
                  mandatory_output_style:
                    "Use concise Chinese ecommerce prompt text. Preserve explicit sections or sentences for 平台视觉 DNA, 中国平台风格指纹, 移动端缩略图规则, 角色版式配方, 中文文案策略, 产品还原硬规则. Do not remove these constraints during polishing.",
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
      },
      {
        signal: abortController.signal,
      },
    );

    return coercePromptOutput(
      JSON.parse(getOpenAIResponseText(payload)),
      input.prompts,
    );
  } catch (error) {
    if (abortController.signal.aborted) {
      throw new Error(
        `Prompt enhancement timed out after ${getPromptEnhancementTimeoutMs()}ms; returned deterministic prompts instead.`,
      );
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
