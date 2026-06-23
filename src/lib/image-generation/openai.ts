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
  referenceImageUrl?: string | null;
  styleReferenceImageUrl?: string | null;
  size: "1024x1024" | "1024x1536" | "1536x1024";
  quality: "low" | "medium" | "high";
  outputFormat: "png" | "webp" | "jpeg";
};

function supportsExplicitInputFidelity(model: string) {
  return !model.toLowerCase().startsWith("gpt-image-2");
}

export async function generateImageWithOpenAI(options: ImageGenerationOptions) {
  const prompt = options.referenceImageUrl
    ? [
        "Use the input product image as the non-negotiable product identity reference.",
        "Preserve the exact product shape, package structure, label placement, colors, visible text, cap, material, proportions, and contents.",
        options.styleReferenceImageUrl
          ? "Use the second input image only as a visual style reference for composition, color palette, typography rhythm, annotation density, lighting, and background mood. Never copy its product, brand, packaging, claims, or accessories."
          : "",
        "Only change the surrounding scene, layout, lighting, annotations, and ecommerce presentation requested below.",
        options.prompt,
      ]
        .filter(Boolean)
        .join("\n\n")
    : options.prompt;
  const path = options.referenceImageUrl ? "images/edits" : "images/generations";
  const body: Record<string, unknown> = {
    model: options.model,
    prompt,
    n: 1,
    size: options.size,
    quality: options.quality,
    output_format: options.outputFormat,
  };

  if (options.referenceImageUrl) {
    body.images = [
      { image_url: options.referenceImageUrl },
      ...(options.styleReferenceImageUrl
        ? [{ image_url: options.styleReferenceImageUrl }]
        : []),
    ];

    if (supportsExplicitInputFidelity(options.model)) {
      body.input_fidelity = "high";
    }
  }

  const payload = await openAIFetch<OpenAIImageGenerationResponse>(
    path,
    body,
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
