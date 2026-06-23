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

function getOpenAIBaseUrl() {
  return (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1")
    .trim()
    .replace(/\/+$/, "");
}

function getOpenAIProxyUrl() {
  return (
    process.env.OPENAI_PROXY_URL ||
    process.env.HTTPS_PROXY ||
    process.env.HTTP_PROXY ||
    process.env.ALL_PROXY ||
    ""
  ).trim();
}

export async function openAIFetch<TPayload>(
  path: string,
  body: Record<string, unknown>,
) {
  const proxyUrl = getOpenAIProxyUrl();
  const url = `${getOpenAIBaseUrl()}/${path.replace(/^\/+/, "")}`;
  const init = {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getOpenAIApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  } satisfies RequestInit;
  let response: Response;

  if (proxyUrl) {
    const { ProxyAgent, fetch: undiciFetch } = await import("undici");
    const proxyInit = {
      method: init.method,
      headers: init.headers as Record<string, string>,
      body: init.body as string,
      dispatcher: new ProxyAgent(proxyUrl),
    };

    response = (await undiciFetch(url, proxyInit)) as unknown as Response;
  } else {
    response = await fetch(url, init);
  }

  const responseText = await response.text();
  let payload: TPayload & OpenAIErrorPayload;

  try {
    payload = JSON.parse(responseText) as TPayload & OpenAIErrorPayload;
  } catch {
    const contentType = response.headers.get("content-type") || "unknown";
    const preview = responseText
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 120);

    throw new Error(
      `OpenAI API returned a non-JSON response (${response.status}, ${contentType}) for ${path}. ${preview}`,
    );
  }

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
