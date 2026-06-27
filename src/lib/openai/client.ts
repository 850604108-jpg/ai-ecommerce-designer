type OpenAIErrorPayload = {
  error?: {
    message?: string;
  };
};

const retryableStatuses = new Set([
  408,
  409,
  425,
  429,
  500,
  502,
  503,
  504,
  524,
]);
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

function getOpenAIMaxAttempts() {
  const parsed = Number.parseInt(process.env.OPENAI_MAX_ATTEMPTS || "", 10);

  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), 5) : 3;
}

function getOpenAIBaseRetryDelayMs() {
  const parsed = Number.parseInt(process.env.OPENAI_RETRY_DELAY_MS || "", 10);

  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 250), 10_000) : 1500;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRetryDelayMs(attempt: number) {
  const baseDelay = getOpenAIBaseRetryDelayMs();
  const backoff = baseDelay * 2 ** Math.max(attempt - 1, 0);
  const jitter = Math.round(Math.random() * baseDelay);

  return Math.min(backoff + jitter, 30_000);
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
  signal?: AbortSignal;
  url: string;
}) {
  const init = {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
    },
    body: input.body,
    signal: input.signal,
  } satisfies RequestInit;

  if (input.proxyUrl) {
    const { ProxyAgent, fetch: undiciFetch } = await import("undici");

    return (await undiciFetch(input.url, {
      method: init.method,
      headers: init.headers as Record<string, string>,
      body: init.body as string,
      dispatcher: new ProxyAgent(input.proxyUrl),
      signal: input.signal,
    })) as unknown as Response;
  }

  return fetch(input.url, init);
}

export async function openAIFetch<TPayload>(
  path: string,
  body: Record<string, unknown>,
  options: { signal?: AbortSignal } = {},
) {
  const proxyUrl = getOpenAIProxyUrl();
  const url = `${getOpenAIBaseUrl()}/${path.replace(/^\/+/, "")}`;
  const requestBody = JSON.stringify(body);
  const apiKeys = getOpenAIApiKeys();
  const maxAttempts = getOpenAIMaxAttempts();
  const totalAttempts = apiKeys.length * maxAttempts;
  let lastError: Error | null = null;

  if (!apiKeys.length) {
    throw new Error("Missing OPENAI_API_KEY.");
  }

  for (let attempt = 0; attempt < totalAttempts; attempt += 1) {
    if (options.signal?.aborted) {
      throw lastError || new Error("OpenAI API request aborted.");
    }

    const apiKey = getNextOpenAIApiKey();

    try {
      const response = await fetchOpenAIWithKey({
        apiKey,
        body: requestBody,
        proxyUrl,
        signal: options.signal,
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
          attempt < totalAttempts - 1
        ) {
          await sleep(getRetryDelayMs(attempt + 1));
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

        if (attempt < totalAttempts - 1) {
          await sleep(getRetryDelayMs(attempt + 1));
          continue;
        }

        throw lastError;
      }
    } catch (error) {
      lastError =
        error instanceof Error
          ? error
          : new Error("OpenAI API request failed.");

      if (options.signal?.aborted) {
        throw lastError;
      }

      if (
        error instanceof OpenAIRequestFailure &&
        !error.retryable
      ) {
        throw error;
      }

      if (attempt < totalAttempts - 1) {
        await sleep(getRetryDelayMs(attempt + 1));
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
