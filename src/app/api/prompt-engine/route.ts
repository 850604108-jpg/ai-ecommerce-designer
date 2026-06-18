import { NextResponse } from "next/server";

import {
  ecommercePlatforms,
  generatePromptSet,
  getPlatformProfile,
  isEcommercePlatform,
  type PromptEngineInput,
} from "@/lib/prompt-engine";
import { enhancePromptSetWithOpenAI } from "@/lib/prompt-engine/openai";

function normalizeBody(value: unknown): PromptEngineInput {
  const record =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};

  return {
    product_name:
      typeof record.product_name === "string" ? record.product_name : "",
    category: typeof record.category === "string" ? record.category : "",
    highlights: Array.isArray(record.highlights)
      ? record.highlights.filter((item): item is string => typeof item === "string")
      : [],
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const platform = isEcommercePlatform(body.platform)
      ? body.platform
      : undefined;

    const input = normalizeBody(body);
    const resolvedPlatform = platform || "taobao";
    const deterministicPrompts = generatePromptSet(input, { platform });
    const prompts =
      process.env.OPENAI_PROMPT_ENGINE_ENABLED === "false"
        ? deterministicPrompts
        : await enhancePromptSetWithOpenAI({
            product: input,
            platformLabel: getPlatformProfile(resolvedPlatform).label,
            prompts: deterministicPrompts,
          });

    return NextResponse.json({
      platform: resolvedPlatform,
      supportedPlatforms: ecommercePlatforms,
      prompts,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Prompt generation failed.",
      },
      { status: 400 },
    );
  }
}
