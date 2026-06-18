import { openAIFetch } from "@/lib/openai/client";

type OpenAIImageGenerationResponse = {
  data?: Array<{
    b64_json?: string;
    revised_prompt?: string;
    url?: string;
  }>;
  usage?: unknown;
  error?: {
    message?: string;
  };
};

export type ImageGenerationOptions = {
  model: string;
  prompt: string;
  size: "1024x1024" | "1024x1536" | "1536x1024";
  quality: "low" | "medium" | "high";
  outputFormat: "png" | "webp" | "jpeg";
};

export async function generateImageWithOpenAI(options: ImageGenerationOptions) {
  const payload = await openAIFetch<OpenAIImageGenerationResponse>(
    "images/generations",
    {
      model: options.model,
      prompt: options.prompt,
      n: 1,
      size: options.size,
      quality: options.quality,
      output_format: options.outputFormat,
    },
  );

  const b64Json = payload.data?.[0]?.b64_json;

  if (!b64Json) {
    throw new Error("OpenAI did not return image data.");
  }

  return {
    bytes: Buffer.from(b64Json, "base64"),
    revisedPrompt: payload.data?.[0]?.revised_prompt || null,
    usage: payload.usage || null,
  };
}
