import { streamText, type ModelMessage } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import OpenAI from "openai";
import type { AISettings } from "./aiPrefs";

export type AIChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type StreamChunk =
  | { type: "text"; content: string }
  | { type: "thinking"; content: string };

export async function* streamAIReply(args: {
  settings: AISettings;
  messages: AIChatMessage[];
  abortSignal?: AbortSignal;
}): AsyncGenerator<StreamChunk> {
  const { settings, messages, abortSignal } = args;
  const apiKey = settings.apiKey.trim();
  if (!apiKey) {
    throw new Error("API key is missing. Set it in Preferences.");
  }

  const baseURL = settings.baseURL.trim();
  if (!baseURL) {
    throw new Error("Base URL is missing. Set it in Preferences.");
  }

  const client = new OpenAI({
    apiKey,
    baseURL,
    dangerouslyAllowBrowser: true,
  });

  const stream = await client.chat.completions.create(
    {
      model: settings.model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      temperature: clamp(settings.temperature, 0, 2),
      max_tokens: Math.max(1, Math.floor(settings.maxTokens)),
      stream: true,
    },
    { signal: abortSignal },
  );

  let inThinking = false;
  let remainder = "";

  for await (const chunk of stream) {
    const raw = chunk.choices?.[0]?.delta;
    if (!raw) continue;

    const reasoning = (raw as Record<string, unknown>).reasoning_content as
      | string
      | undefined;
    if (reasoning) {
      yield { type: "thinking", content: reasoning };
      continue;
    }

    const rawContent = raw.content;
    if (!rawContent) continue;

    remainder += rawContent;
    const parsed = parseThinkingTags(remainder, inThinking);
    inThinking = parsed.inThinking;
    remainder = parsed.remainder;

    for (const seg of parsed.segments) {
      yield seg;
    }
  }

  if (remainder) {
    yield inThinking
      ? { type: "thinking", content: remainder }
      : { type: "text", content: remainder };
  }
}

function parseThinkingTags(
  text: string,
  inThinking: boolean,
): { segments: StreamChunk[]; inThinking: boolean; remainder: string } {
  const segments: StreamChunk[] = [];
  let pos = 0;
  let thinking = inThinking;

  while (pos < text.length) {
    if (!thinking) {
      const openIdx = text.indexOf("<thinking>", pos);
      if (openIdx === -1) {
        segments.push({ type: "text", content: text.slice(pos) });
        pos = text.length;
      } else {
        if (openIdx > pos) {
          segments.push({ type: "text", content: text.slice(pos, openIdx) });
        }
        pos = openIdx + "<thinking>".length;
        thinking = true;
      }
    } else {
      const closeIdx = text.indexOf("</thinking>", pos);
      if (closeIdx === -1) {
        segments.push({ type: "thinking", content: text.slice(pos) });
        pos = text.length;
      } else {
        if (closeIdx > pos) {
          segments.push({
            type: "thinking",
            content: text.slice(pos, closeIdx),
          });
        }
        pos = closeIdx + "</thinking>".length;
        thinking = false;
      }
    }
  }

  return { segments, inThinking: thinking, remainder: "" };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
