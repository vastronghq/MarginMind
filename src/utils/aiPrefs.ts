import { getPref, setPref } from "./prefs";

type PluginPrefsMap = _ZoteroTypes.Prefs["PluginPrefsMap"];

export type AIProvider =
  | "openai"
  | "anthropic"
  | "openrouter"
  | "openaiCompatible";

export type AISettings = {
  provider: AIProvider;
  apiKey: string;
  baseURL: string;
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
};

export const AI_PROVIDER_OPTIONS: Array<{ value: AIProvider; label: string }> =
  [
    { value: "openai", label: "OpenAI" },
    { value: "anthropic", label: "Claude (Anthropic)" },
    { value: "openrouter", label: "OpenRouter" },
    { value: "openaiCompatible", label: "OpenAI Compatible" },
  ];

export const AI_DEFAULTS: AISettings = {
  provider: "openai",
  apiKey: "",
  baseURL: "",
  model: "gpt-4.1-mini",
  temperature: 0.2,
  maxTokens: 1200,
  systemPrompt:
    "You are InSituAI, an academic research assistant. Give precise, structured, and evidence-oriented answers based on the provided paper context.",
};

export function getDefaultBaseURL(provider: AIProvider) {
  switch (provider) {
    case "openai":
      return "https://api.openai.com/v1";
    case "anthropic":
      return "https://api.anthropic.com/v1";
    case "openrouter":
      return "https://openrouter.ai/api/v1";
    case "openaiCompatible":
      return "";
    default:
      return "";
  }
}

export function getDefaultModel(provider: AIProvider) {
  switch (provider) {
    case "openai":
      return "gpt-4.1-mini";
    case "anthropic":
      return "claude-3-7-sonnet-latest";
    case "openrouter":
      return "openai/gpt-4.1-mini";
    case "openaiCompatible":
      return "gpt-4.1-mini";
    default:
      return AI_DEFAULTS.model;
  }
}

export function loadAISettings(): AISettings {
  const provider = getPref("aiProvider");
  const apiKey = getPref("aiApiKey");
  const baseURL = getPref("aiBaseURL");
  const model = getPref("aiModel");
  const temperature = getPref("aiTemperature");
  const maxTokens = getPref("aiMaxTokens");
  const systemPrompt = getPref("aiSystemPrompt");

  return {
    provider: isAIProvider(provider) ? provider : AI_DEFAULTS.provider,
    apiKey: typeof apiKey === "string" ? apiKey : AI_DEFAULTS.apiKey,
    baseURL: typeof baseURL === "string" ? baseURL : AI_DEFAULTS.baseURL,
    model: typeof model === "string" ? model : AI_DEFAULTS.model,
    temperature:
      typeof temperature === "number" ? temperature : AI_DEFAULTS.temperature,
    maxTokens:
      typeof maxTokens === "number" ? maxTokens : AI_DEFAULTS.maxTokens,
    systemPrompt:
      typeof systemPrompt === "string"
        ? systemPrompt
        : AI_DEFAULTS.systemPrompt,
  };
}

function isAIProvider(value: unknown): value is AIProvider {
  return (
    value === "openai" ||
    value === "anthropic" ||
    value === "openrouter" ||
    value === "openaiCompatible"
  );
}

export function saveAISetting<K extends keyof AISettings>(
  key: K,
  value: AISettings[K],
) {
  switch (key) {
    case "provider":
      setPref("aiProvider", value as PluginPrefsMap["aiProvider"]);
      break;
    case "apiKey":
      setPref("aiApiKey", value as string);
      break;
    case "baseURL":
      setPref("aiBaseURL", value as string);
      break;
    case "model":
      setPref("aiModel", value as string);
      break;
    case "temperature":
      setPref("aiTemperature", value as number);
      break;
    case "maxTokens":
      setPref("aiMaxTokens", value as number);
      break;
    case "systemPrompt":
      setPref("aiSystemPrompt", value as string);
      break;
    default:
      break;
  }
}

export function resetAISettings() {
  setPref("aiProvider", AI_DEFAULTS.provider);
  setPref("aiApiKey", AI_DEFAULTS.apiKey);
  setPref("aiBaseURL", AI_DEFAULTS.baseURL);
  setPref("aiModel", AI_DEFAULTS.model);
  setPref("aiTemperature", AI_DEFAULTS.temperature);
  setPref("aiMaxTokens", AI_DEFAULTS.maxTokens);
  setPref("aiSystemPrompt", AI_DEFAULTS.systemPrompt);
}
