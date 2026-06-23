type OpenAIErrorPayload = {
  error?: {
    message?: string;
  };
};

const retryableStatuses = new Set([408, 409, 425, 429, 500, 502, 503, 504]);
let nextOpenAIKeyIndex = 0;

class OpenAIRequestFailure extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "OpenAIRequestFailure";
  }
}

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

export function getOpenAIApiKeys() {
  const configuredKeys = [
    process.env.OPENAI_API_KEY,
    process.env.OPENAI_API_KEYS,
  ]
    .filter(Boolean)
    .flatMap((value) => value?.split(/[\s,;]+/) || [])
    .map((value) => value.trim())
    .filter(Boolean);

  return Array.from(new Set(configuredKeys));
}

export function getOpenAIApiKey() {
  const apiKey = getOpenAIApiKeys()[0];

  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY.");
  }

  return apiKey;
}

function getNextOpenAIApiKey() {
  const apiKeys = getOpenAIApiKeys();

  if (!apiKeys.length) {
    throw new Error("Missing OPENAI_API_KEY.");
  }

  const apiKey = apiKeys[nextOpenAIKeyIndex % apiKeys.length];
  nextOpenAIKeyIndex = (nextOpenAIKeyIndex + 1) % apiKeys.length;

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

function isRetryableOpenAIStatus(status: number) {
  return retryableStatuses.has(status);
}

function toOpenAIErrorMessage(input: {
  fallback: string;
  path: string;
  responseText: string;
  status: number;
}) {
  try {
    const payload = JSON.parse(input.responseText) as OpenAIErrorPayload;

    return payload.error?.message || input.fallback;
  } catch {
    const preview = input.responseText
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 120);

    return `OpenAI API request failed (${input.status}) for ${input.path}. ${preview}`;
  }
}

async function fetchOpenAIWithKey(input: {
  apiKey: string;
  body: string;
  proxyUrl: string;
  url: string;
}) {
  const init = {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
    },
    body: input.body,
  } satisfies RequestInit;

  if (input.proxyUrl) {
    const { ProxyAgent, fetch: undiciFetch } = await import("undici");

    return (await undiciFetch(input.url, {
      method: init.method,
      headers: init.headers as Record<string, string>,
      body: init.body as string,
      dispatcher: new ProxyAgent(input.proxyUrl),
    })) as unknown as Response;
  }

  return fetch(input.url, init);
}

export async function openAIFetch<TPayload>(
  path: string,
  body: Record<string, unknown>,
) {
  const proxyUrl = getOpenAIProxyUrl();
  const url = `${getOpenAIBaseUrl()}/${path.replace(/^\/+/, "")}`;
  const requestBody = JSON.stringify(body);
  const apiKeys = getOpenAIApiKeys();
  let lastError: Error | null = null;

  if (!apiKeys.length) {
    throw new Error("Missing OPENAI_API_KEY.");
  }

  for (let attempt = 0; attempt < apiKeys.length; attempt += 1) {
    const apiKey = getNextOpenAIApiKey();

    try {
      const response = await fetchOpenAIWithKey({
        apiKey,
        body: requestBody,
        proxyUrl,
        url,
      });
      const responseText = await response.text();

      if (!response.ok) {
        const message = toOpenAIErrorMessage({
          fallback: "OpenAI API request failed.",
          path,
          responseText,
          status: response.status,
        });
        const retryable = isRetryableOpenAIStatus(response.status);
        lastError = new OpenAIRequestFailure(message, retryable);

        if (
          retryable &&
          attempt < apiKeys.length - 1
        ) {
          continue;
        }

        throw lastError;
      }

      try {
        return JSON.parse(responseText) as TPayload & OpenAIErrorPayload;
      } catch {
        const contentType = response.headers.get("content-type") || "unknown";
        const preview = responseText
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 120);
        lastError = new Error(
          `OpenAI API returned a non-JSON response (${response.status}, ${contentType}) for ${path}. ${preview}`,
        );

        if (attempt < apiKeys.length - 1) {
          continue;
        }

        throw lastError;
      }
    } catch (error) {
      lastError =
        error instanceof Error
          ? error
          : new Error("OpenAI API request failed.");

      if (
        error instanceof OpenAIRequestFailure &&
        !error.retryable
      ) {
        throw error;
      }

      if (attempt < apiKeys.length - 1) {
        continue;
      }
    }
  }

  throw lastError || new Error("OpenAI API request failed.");
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
