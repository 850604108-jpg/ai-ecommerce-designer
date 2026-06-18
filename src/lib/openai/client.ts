type OpenAIErrorPayload = {
  error?: {
    message?: string;
  };
};

export type OpenAIResponseContent = {
  text?: string;
  type?: string;
};

export type OpenAIResponsesPayload = {
  output?: Array<{
    content?: OpenAIResponseContent[];
  }>;
  output_text?: string;
};

export const defaultOpenAIImageModel =
  process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";
export const defaultOpenAIVisionModel =
  process.env.OPENAI_VISION_MODEL || "gpt-5.5";
export const defaultOpenAIPromptModel =
  process.env.OPENAI_PROMPT_ENGINE_MODEL ||
  process.env.OPENAI_VISION_MODEL ||
  "gpt-5.5";

export function getOpenAIApiKey() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY.");
  }

  return apiKey;
}

export async function openAIFetch<TPayload>(
  path: string,
  body: Record<string, unknown>,
) {
  const response = await fetch(`https://api.openai.com/v1/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getOpenAIApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const payload = (await response.json()) as TPayload & OpenAIErrorPayload;

  if (!response.ok) {
    throw new Error(payload.error?.message || "OpenAI API request failed.");
  }

  return payload;
}

export function getOpenAIResponseText(response: OpenAIResponsesPayload) {
  if (response.output_text) {
    return response.output_text;
  }

  return (
    response.output
      ?.flatMap((item) => item.content || [])
      .map((content) => content.text)
      .filter(Boolean)
      .join("\n") || ""
  );
}
