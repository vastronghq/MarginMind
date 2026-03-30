import { getPref, setPref } from "../utils/prefs";

type PluginPrefsMap = _ZoteroTypes.Prefs["PluginPrefsMap"];

export type AIProvider =
  // --- 国际顶级大厂 (Tier 1) ---
  | "openai" // OpenAI (美国): ChatGPT, GPT-4o, o1 系列标杆
  | "anthropic" // Anthropic (美国): Claude 3.5 Sonnet/Opus, 以长文本和编程能力见长
  | "google" // Google (美国): Gemini 1.5 Pro/Flash, 生态集成度高

  // --- 国内大模型 (国产之光) ---
  | "deepseek" // DeepSeek (深度求索 - 杭州): 目前国产最强、性价比极高的模型
  | "moonshot" // Moonshot AI (月之暗面 - 北京): Kimi, 擅长超长上下文处理
  | "zhipu" // 智谱 AI (清华系 - 北京): ChatGLM/GLM-4, 国内学术与工程平衡较好的模型
  | "aliyun" // 阿里云 (阿里巴巴): 通义千问 Qwen 系列, 开源与闭源结合最好
  | "volcengine" // 火山引擎 (字节跳动): 豆包 Doubao, 算力储备极其雄厚
  | "minimax" // MiniMax (稀宇科技 - 上海): 海螺 AI, 擅长角色扮演与情感交互
  | "longcat" // LongCat (美团)

  // --- 模型聚合与托管平台 (Aggregators) ---
  | "openrouter" // OpenRouter: 全球模型聚合器，一个 Key 调通几乎所有主流模型
  | "groq" // Groq: 极速推理平台，利用 LPU 技术让 Llama 3 等模型秒出结果
  | "together" // Together AI: 开源模型云端托管平台 (Llama, Qwen 等)
  | "mistral" // Mistral AI (法国): 欧洲最强 AI 公司，Mistral Large/Medium
  | "cohere" // Cohere (加拿大): 专注于企业级 RAG 和搜索增强的模型
  | "perplexity" // Perplexity: 搜索增强大模型接口，专门用于实时联网查询

  // --- 协议兼容性 ---
  | "openaiCompatible"; // 自定义兼容协议: 用于本地 Ollama, One-API, New-API 等私有部署

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
    { value: "openrouter", label: "OpenRouter (全球模型聚合平台)" },
    { value: "openai", label: "OpenAI (GPT系列)" },
    { value: "anthropic", label: "Anthropic (Claude系列)" },
    { value: "google", label: "Google (谷歌, Gemini系列)" },
    { value: "deepseek", label: "DeepSeek (深度求索)" },
    { value: "moonshot", label: "Moonshot AI (月之暗面, Kimi系列)" },
    { value: "zhipu", label: "Z.ai (智谱清言, GLM系列)" },
    { value: "aliyun", label: "Qwen (通义千问, Qwen系列)" },
    { value: "volcengine", label: "Volcengine (火山引擎, Doubao系列)" },
    { value: "minimax", label: "MiniMax (稀宇科技, MiniMax系列)" },
    { value: "longcat", label: "LongCat AI (美团, LongCat系列)" },
    { value: "groq", label: "Groq (极速推理, 开源模型托管)" },
    { value: "mistral", label: "Mistral AI (欧洲开源大模型)" },
    { value: "cohere", label: "Cohere (企业级RAG, 多语言模型)" },
    { value: "perplexity", label: "Perplexity (搜索增强, 联网生成)" },
    { value: "together", label: "Together AI (开源模型聚合推理平台)" },
    {
      value: "openaiCompatible",
      label: "Custom OpenAI (自定义兼容协议, 本地/私有部署)",
    },
  ];

const BASE_URL_MAP: Record<AIProvider, string> = {
  openrouter: "https://openrouter.ai/api/v1",
  openai: "https://api.openai.com/v1",
  anthropic: "https://api.anthropic.com/v1",
  google: "https://generativelanguage.googleapis.com/v1beta",
  deepseek: "https://api.deepseek.com",
  moonshot: "https://api.moonshot.cn/v1",
  zhipu: "https://open.bigmodel.cn/api/paas/v4",
  aliyun: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  volcengine: "https://ark.cn-beijing.volces.com/api/v3",
  minimax: "https://api.minimax.chat/v1",
  longcat: "https://api.longcat.chat/openai/v1",
  groq: "https://api.groq.com/openai/v1",
  mistral: "https://api.mistral.ai/v1",
  cohere: "https://api.cohere.ai/v1",
  perplexity: "https://api.perplexity.ai",
  together: "https://api.together.xyz/v1",
  openaiCompatible: "",
};

const DEFAULT_MODEL_MAP: Record<AIProvider, string> = {
  openrouter: "stepfun/step-3.5-flash:free",
  openai: "gpt-5.4-mini",
  anthropic: "claude-4-sonnet-20260301",
  google: "gemini-3.1-flash",
  deepseek: "deepseek-v4-chat",
  moonshot: "kimi-k2.5-128k",
  zhipu: "glm-5-flash",
  aliyun: "qwen-3.5-omni-flash",
  volcengine: "doubao-seed-1-8-251228",
  minimax: "hailuo-ai-m2.7-flash",
  longcat: "LongCat-Flash-Thinking-2601",
  groq: "llama-4-70b-instruct",
  mistral: "mistral-large-2506",
  cohere: "command-r2-plus",
  perplexity: "sonar-pro",
  together: "meta-llama/Llama-4-70B-Instruct",
  openaiCompatible: "",
};

export const AI_DEFAULTS: AISettings = {
  provider: "openrouter",
  apiKey: "",
  baseURL: BASE_URL_MAP.openrouter,
  model: DEFAULT_MODEL_MAP.openrouter,
  temperature: 0.2,
  maxTokens: 8192,
  systemPrompt:
    "You are MarginMind, an academic research assistant. Give precise, structured, and evidence-oriented answers based on the provided paper context.",
};

export function getDefaultBaseURL(provider: AIProvider): string {
  return BASE_URL_MAP[provider] || "";
}

export function getDefaultModel(provider: AIProvider): string {
  return DEFAULT_MODEL_MAP[provider] || AI_DEFAULTS.model;
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
  return typeof value === "string" && value in BASE_URL_MAP;
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
