import type { AIProvider, AISettings } from "../utils/aiPrefs";

export type AIChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export async function generateAIReply(args: {
  settings: AISettings;
  messages: AIChatMessage[];
}) {
  const { settings, messages } = args;
  if (!settings.apiKey.trim()) {
    throw new Error("API key is missing. Set it in Preferences.");
  }

  switch (settings.provider) {
    case "openai":
    case "openrouter":
    case "openaiCompatible":
      return requestOpenAICompatible(settings, messages);
    case "anthropic":
      return requestAnthropic(settings, messages);
    default:
      throw new Error(`Unsupported provider: ${String(settings.provider)}`);
  }
}

async function requestOpenAICompatible(
  settings: AISettings,
  messages: AIChatMessage[],
) {
  const endpoint = `${resolveBaseURL(settings.provider, settings.baseURL).replace(/\/$/, "")}/chat/completions`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.apiKey.trim()}`,
      ...(settings.provider === "openrouter"
        ? {
            "HTTP-Referer": "https://www.zotero.org/",
            "X-Title": "InSituAI",
          }
        : {}),
    },
    body: JSON.stringify({
      model: settings.model,
      messages,
      temperature: clamp(settings.temperature, 0, 2),
      max_tokens: Math.max(1, Math.floor(settings.maxTokens)),
    }),
  });
  const data = await readJSONResponse(response);
  if (!response.ok) {
    throw new Error(formatAPIError(data, response.status));
  }

  const content = data?.choices?.[0]?.message?.content;
  if (typeof content === "string" && content.trim()) {
    return content.trim();
  }
  if (Array.isArray(content)) {
    const text = content
      .map((part: { text?: string }) => part?.text || "")
      .join("")
      .trim();
    if (text) return text;
  }
  throw new Error("Provider returned an empty response.");
}

async function requestAnthropic(
  settings: AISettings,
  messages: AIChatMessage[],
) {
  const endpoint = `${resolveBaseURL(settings.provider, settings.baseURL).replace(/\/$/, "")}/messages`;
  const systemParts: string[] = [];
  const normalizedMessages: Array<{
    role: "user" | "assistant";
    content: string;
  }> = [];

  for (const message of messages) {
    if (message.role === "system") {
      if (message.content.trim()) {
        systemParts.push(message.content.trim());
      }
      continue;
    }
    normalizedMessages.push({
      role: message.role,
      content: message.content,
    });
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": settings.apiKey.trim(),
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: settings.model,
      system: systemParts.join("\n\n"),
      messages: normalizedMessages,
      temperature: clamp(settings.temperature, 0, 1),
      max_tokens: Math.max(1, Math.floor(settings.maxTokens)),
    }),
  });
  const data = await readJSONResponse(response);
  if (!response.ok) {
    throw new Error(formatAPIError(data, response.status));
  }

  const content = Array.isArray(data?.content) ? data.content : [];
  const text = content
    .map((part: { type?: string; text?: string }) =>
      part?.type === "text" && typeof part.text === "string" ? part.text : "",
    )
    .join("")
    .trim();
  if (!text) {
    throw new Error("Provider returned an empty response.");
  }
  return text;
}

function resolveBaseURL(provider: AIProvider, inputBaseURL: string) {
  const base = inputBaseURL.trim();
  if (base) return base;
  switch (provider) {
    case "openai":
      return "https://api.openai.com/v1";
    case "openrouter":
      return "https://openrouter.ai/api/v1";
    case "anthropic":
      return "https://api.anthropic.com/v1";
    case "openaiCompatible":
      throw new Error("Base URL is required for OpenAI Compatible provider.");
    default:
      return "";
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

async function readJSONResponse(response: Response): Promise<any> {
  try {
    return await response.json();
  } catch (_error) {
    return null;
  }
}

function formatAPIError(data: any, status: number) {
  const message =
    data?.error?.message ||
    data?.message ||
    (typeof data === "string" ? data : "") ||
    `Request failed with status ${status}`;
  return `API error (${status}): ${message}`;
}
