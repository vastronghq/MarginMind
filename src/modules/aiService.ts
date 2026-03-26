import { streamText, type ModelMessage } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { AIProvider, AISettings } from "../utils/aiPrefs";

export type AIChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export async function* streamAIReply(args: {
  settings: AISettings;
  messages: AIChatMessage[];
  abortSignal?: AbortSignal;
}) {
  const { settings, messages, abortSignal } = args;
  const apiKey = settings.apiKey.trim();
  if (!apiKey) {
    throw new Error("API key is missing. Set it in Preferences.");
  }

  const openrouter = createOpenRouter({
    apiKey,
    baseURL: settings.baseURL.trim() || "https://openrouter.ai/api/v1",
  });
  const requestMessages = toModelMessages(messages);
  const model = openrouter(settings.model, {
    provider: getOpenRouterProviderConstraint(settings.provider),
  });

  const result = streamText({
    model,
    messages: requestMessages,
    temperature: clamp(settings.temperature, 0, 2),
    maxOutputTokens: Math.max(1, Math.floor(settings.maxTokens)),
    abortSignal,
  });

  for await (const part of result.fullStream) {
    if (part.type === "error") {
      throw new Error(normalizeErrorMessage(part.error));
    }
    if (part.type === "text-delta" && part.text) {
      yield part.text;
    }
  }
}

function normalizeErrorMessage(error: unknown) {
  if (!error) return "Unknown stream error.";
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string") return error;

  if (typeof error === "object") {
    const maybe = error as {
      message?: string;
      error?: { message?: string };
      cause?: { message?: string };
    };
    if (maybe.message) return maybe.message;
    if (maybe.error?.message) return maybe.error.message;
    if (maybe.cause?.message) return maybe.cause.message;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function toModelMessages(messages: AIChatMessage[]): ModelMessage[] {
  return messages.map((message) => ({
    role: message.role,
    content: message.content,
  }));
}

function getOpenRouterProviderConstraint(provider: AIProvider) {
  switch (provider) {
    case "openai":
      return { only: ["openai"] };
    case "anthropic":
      return { only: ["anthropic"] };
    case "openrouter":
    case "openaiCompatible":
      return undefined;
    default:
      return undefined;
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
