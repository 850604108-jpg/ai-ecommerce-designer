import {
  defaultOpenAIVisionModel,
  getOpenAIResponseText,
  openAIFetch,
  type OpenAIResponsesPayload,
} from "@/lib/openai/client";

export type ProductRecognition = {
  product_name: string;
  category: string;
  target_user: string;
  highlights: string[];
};

export type ProductRecognitionResult = {
  model: string;
  rawResponse: unknown;
  recognition: ProductRecognition;
  warning?: string;
};

const productRecognitionSchema = {
  type: "object",
  additionalProperties: false,
  required: ["product_name", "category", "target_user", "highlights"],
  properties: {
    product_name: {
      type: "string",
      description: "The concise product name inferred from the image.",
    },
    category: {
      type: "string",
      description: "The ecommerce product category.",
    },
    target_user: {
      type: "string",
      description: "The most likely target user or buyer segment.",
    },
    highlights: {
      type: "array",
      description: "Visible selling points or product highlights.",
      minItems: 0,
      maxItems: 6,
      items: { type: "string" },
    },
  },
} as const;

function normalizeRecognition(value: unknown): ProductRecognition {
  const record =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  const highlights = Array.isArray(record.highlights)
    ? record.highlights
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];

  return {
    product_name:
      typeof record.product_name === "string" ? record.product_name.trim() : "",
    category: typeof record.category === "string" ? record.category.trim() : "",
    target_user:
      typeof record.target_user === "string" ? record.target_user.trim() : "",
    highlights,
  };
}

export function createFallbackProductRecognition(error: unknown): ProductRecognitionResult {
  const message =
    error instanceof Error ? error.message : "Product recognition failed.";

  return {
    model: `${defaultOpenAIVisionModel}:fallback`,
    rawResponse: {
      error: message,
      fallback: true,
    },
    recognition: {
      product_name: "待确认商品",
      category: "待确认品类",
      target_user: "",
      highlights: [],
    },
    warning: `AI 识别暂时不可用，已创建可编辑的待确认信息。原因：${message}`,
  };
}

export async function recognizeProductFromImage(imageUrl: string): Promise<ProductRecognitionResult> {
  const model = defaultOpenAIVisionModel;
  const payload = await openAIFetch<OpenAIResponsesPayload>("responses", {
    model,
    input: [
      {
        role: "system",
        content:
          "You identify ecommerce products from uploaded images. Return only the requested structured fields. If a field is uncertain, provide the best concise inference.",
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: "识别这张商品图，返回 product_name、category、target_user、highlights。highlights 使用中文短语，最多 6 条。",
          },
          {
            type: "input_image",
            image_url: imageUrl,
          },
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "product_recognition",
        strict: true,
        schema: productRecognitionSchema,
      },
    },
  });

  const text = getOpenAIResponseText(payload);
  const parsed = JSON.parse(text) as unknown;

  return {
    model,
    rawResponse: payload,
    recognition: normalizeRecognition(parsed),
  };
}
