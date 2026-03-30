import { getPref, setPref } from "./prefs";

type PluginPrefsMap = _ZoteroTypes.Prefs["PluginPrefsMap"];

export type AIProvider =
  | "openai"
  | "anthropic"
  | "openrouter"
  | "openaiCompatible"
  | "volcengine";

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
    { value: "openrouter", label: "OpenRouter (Auto)" },
    { value: "openai", label: "OpenRouter -> OpenAI" },
    { value: "anthropic", label: "OpenRouter -> Anthropic" },
    { value: "openaiCompatible", label: "OpenAI Compatible" },
    { value: "volcengine", label: "Volcengine (Ark)" },
  ];

export const AI_DEFAULTS: AISettings = {
  provider: "openrouter",
  apiKey: "",
  baseURL: "https://openrouter.ai/api/v1",
  model: "stepfun/step-3.5-flash:free",
  temperature: 0.2,
  maxTokens: 4096,
  systemPrompt:
    "You are MarginMind, an academic research assistant. Give precise, structured, and evidence-oriented answers based on the provided paper context.",
};

export function getDefaultBaseURL(provider: AIProvider) {
  switch (provider) {
    case "openai":
      return "https://openrouter.ai/api/v1";
    case "anthropic":
      return "https://openrouter.ai/api/v1";
    case "openrouter":
      return "https://openrouter.ai/api/v1";
    case "openaiCompatible":
      return "";
    case "volcengine":
      return "https://ark.cn-beijing.volces.com/api/v3";
    default:
      return "";
  }
}

export function getDefaultModel(provider: AIProvider) {
  switch (provider) {
    case "openai":
      return "openai/gpt-4.1-mini";
    case "anthropic":
      return "anthropic/claude-3.7-sonnet";
    case "openrouter":
      return "stepfun/step-3.5-flash:free";
    case "openaiCompatible":
      return "gpt-4.1-mini";
    case "volcengine":
      return "doubao-seed-1.8-flash";
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
  const parsedTemperature = Number.parseFloat(temperature);

  return {
    provider: isAIProvider(provider) ? provider : AI_DEFAULTS.provider,
    apiKey: typeof apiKey === "string" ? apiKey : AI_DEFAULTS.apiKey,
    baseURL: typeof baseURL === "string" ? baseURL : AI_DEFAULTS.baseURL,
    model: typeof model === "string" ? model : AI_DEFAULTS.model,
    temperature: Number.isFinite(parsedTemperature)
      ? parsedTemperature
      : AI_DEFAULTS.temperature,
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
    value === "openaiCompatible" ||
    value === "volcengine"
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
      setPref("aiTemperature", String(value));
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
  setPref("aiTemperature", String(AI_DEFAULTS.temperature));
  setPref("aiMaxTokens", AI_DEFAULTS.maxTokens);
  setPref("aiSystemPrompt", AI_DEFAULTS.systemPrompt);
}

// ─── Presets ───────────────────────────────────────────────────────────────

export type AIPreset = {
  name: string;
  settings: AISettings;
};

export function loadPresets(): AIPreset[] {
  const raw = getPref("aiPresets");
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter(
      (p: any) =>
        p &&
        typeof p.name === "string" &&
        p.settings &&
        typeof p.settings === "object",
    );
  } catch {
    return [];
  }
}

function writePresets(presets: AIPreset[]) {
  setPref("aiPresets", JSON.stringify(presets));
}

export function savePreset(name: string, settings: AISettings) {
  const presets = loadPresets();
  const idx = presets.findIndex((p) => p.name === name);
  const entry: AIPreset = { name, settings: { ...settings } };
  if (idx >= 0) {
    presets[idx] = entry;
  } else {
    presets.push(entry);
  }
  writePresets(presets);
}

export function deletePreset(name: string) {
  const presets = loadPresets().filter((p) => p.name !== name);
  writePresets(presets);
}

export function applyPreset(preset: AIPreset) {
  const s = preset.settings;
  saveAISetting("provider", s.provider);
  saveAISetting("apiKey", s.apiKey);
  saveAISetting("baseURL", s.baseURL);
  saveAISetting("model", s.model);
  saveAISetting("temperature", s.temperature);
  saveAISetting("maxTokens", s.maxTokens);
  saveAISetting("systemPrompt", s.systemPrompt);
}
