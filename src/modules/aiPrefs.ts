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
  | "modelscope" // ModelScope ：魔搭社区，阿里达摩院维护的模型开源及推理平台
  | "groq" // Groq: 极速推理平台，利用 LPU 技术让 Llama 3 等模型秒出结果
  | "together" // Together AI: 开源模型云端托管平台 (Llama, Qwen 等)
  | "mistral" // Mistral AI (法国): 欧洲最强 AI 公司，Mistral Large/Medium
  | "cohere" // Cohere (加拿大): 专注于企业级 RAG 和搜索增强的模型
  | "perplexity" // Perplexity: 搜索增强大模型接口，专门用于实时联网查询
  | "siliconflow" // 硅基流动：模型聚合平台

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
  quickActionPrompts: Record<QuickActionPromptKey, string>;
};

export const AI_PROVIDER_OPTIONS: Array<{ value: AIProvider; label: string }> =
  [
    // --- 国际顶级大厂 (Tier 1) ---
    { value: "openai", label: "OpenAI" },
    { value: "anthropic", label: "Anthropic" },
    { value: "google", label: "Google" },

    // --- 国内大模型 (国产之光) ---
    { value: "deepseek", label: "DeepSeek" },
    { value: "moonshot", label: "Moonshot AI (Kimi)" },
    { value: "zhipu", label: "Zhipu AI (GLM)" },
    { value: "aliyun", label: "Qwen" },
    { value: "volcengine", label: "Volcengine (Doubao)" },
    { value: "minimax", label: "MiniMax" },
    { value: "longcat", label: "LongCat AI" },

    // --- 模型聚合与托管平台 (Aggregators) ---
    { value: "openrouter", label: "OpenRouter" },
    { value: "modelscope", label: "ModelScope" },
    { value: "groq", label: "Groq" },
    { value: "together", label: "Together AI" },
    { value: "mistral", label: "Mistral AI" },
    { value: "cohere", label: "Cohere" },
    { value: "perplexity", label: "Perplexity" },
    { value: "siliconflow", label: "SiliconFlow" },

    // --- 协议兼容性 ---
    {
      value: "openaiCompatible",
      label: "OpenAI Compatible",
    },
  ];

const BASE_URL_MAP: Record<AIProvider, string> = {
  openai: "https://api.openai.com/v1",
  anthropic: "https://api.anthropic.com/v1",
  google: "https://generativelanguage.googleapis.com/v1beta/openai/",
  deepseek: "https://api.deepseek.com",
  moonshot: "https://api.moonshot.cn/v1",
  zhipu: "https://open.bigmodel.cn/api/paas/v4",
  aliyun: "https://dashscope.aliyuncs.com/api/v1",
  volcengine: "https://ark.cn-beijing.volces.com/api/v3",
  minimax: "https://api.minimax.chat/v1",
  longcat: "https://api.longcat.chat/openai/v1",
  openrouter: "https://openrouter.ai/api/v1",
  modelscope: "https://api-inference.modelscope.cn/v1",
  groq: "https://api.groq.com/openai/v1",
  together: "https://api.together.xyz/v1",
  mistral: "https://api.mistral.ai/v1",
  cohere: "https://api.cohere.ai/v1",
  perplexity: "https://api.perplexity.ai",
  siliconflow: "https://api.siliconflow.cn/v1",
  openaiCompatible: "",
};

const DEFAULT_MODEL_MAP: Record<AIProvider, string> = {
  openai: "",
  anthropic: "",
  google: "",
  deepseek: "",
  moonshot: "",
  zhipu: "",
  aliyun: "",
  volcengine: "",
  minimax: "",
  longcat: "",
  openrouter: "",
  modelscope: "",
  groq: "",
  together: "",
  mistral: "",
  cohere: "",
  perplexity: "",
  siliconflow: "",
  openaiCompatible: "",
};

export const PROMPTS_EN = {};

export const PROMPTS = {
  // systemPrompt: "You are MarginMind, an academic research assistant. Give precise, structured, and evidence-oriented answers based on the provided paper context. (Respond in the user's language)",
  systemPrompt: "",
  critiqueFullText: "",
  explainSelection:
    "请你作为本对话领域的专家，先拆解选文中的专业术语与概念，给出它们的定义（如涉及交叉学科，请剥离交叉部分，还原其在原学科中的定义）；再结合选文所处的学科背景，将这些概念串联起来，阐述选文的具体含义。",
  critiqueSelection:
    "请对给定文本的假设、方法论与论证进行批判性分析，指出其中的不足之处、未经检验的前提以及牵强解释。",
  bulletizeSelection: "将所选文本提炼为要点，每条要点保持简洁、清晰。",
  translateSelection:
    "请使用规范的学术术语将以下内容翻译成`中文`。确保技术术语符合`计算机科学/化学/生物学/人工智能`领域的标准表述。重要术语保留英文原文，并在括号内附上翻译。仅输出翻译结果，保持专业、客观的语气。",
  summarizeFullText:
    "请总结本文所要解决的核心问题、主要方法论、论点与关键发现，并重点阐述其方法论的独特之处。",
};

export const AI_DEFAULTS: AISettings = {
  provider: "openrouter",
  apiKey: "",
  baseURL: BASE_URL_MAP.openrouter,
  model: DEFAULT_MODEL_MAP.openrouter,
  temperature: 0.2,
  maxTokens: 8192,
  systemPrompt: PROMPTS.systemPrompt,
  quickActionPrompts: {
    quickActionExplainPrompt: PROMPTS.explainSelection,
    quickActionCritiquePrompt: PROMPTS.critiqueSelection,
    quickActionBulletizePrompt: PROMPTS.bulletizeSelection,
    quickActionTranslatePrompt: PROMPTS.translateSelection,
    quickActionSummarizePrompt: PROMPTS.summarizeFullText,
  },
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
  const quickActionExplainPrompt = getPref("quickActionExplainPrompt");
  const quickActionCritiquePrompt = getPref("quickActionCritiquePrompt");
  const quickActionBulletizePrompt = getPref("quickActionBulletizePrompt");
  const quickActionTranslatePrompt = getPref("quickActionTranslatePrompt");
  const quickActionSummarizePrompt = getPref("quickActionSummarizePrompt");
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
    quickActionPrompts: {
      quickActionExplainPrompt:
        typeof quickActionExplainPrompt === "string"
          ? quickActionExplainPrompt
          : AI_DEFAULTS.quickActionPrompts.quickActionExplainPrompt,
      quickActionCritiquePrompt:
        typeof quickActionCritiquePrompt === "string"
          ? quickActionCritiquePrompt
          : AI_DEFAULTS.quickActionPrompts.quickActionCritiquePrompt,
      quickActionBulletizePrompt:
        typeof quickActionBulletizePrompt === "string"
          ? quickActionBulletizePrompt
          : AI_DEFAULTS.quickActionPrompts.quickActionBulletizePrompt,
      quickActionTranslatePrompt:
        typeof quickActionTranslatePrompt === "string"
          ? quickActionTranslatePrompt
          : AI_DEFAULTS.quickActionPrompts.quickActionTranslatePrompt,
      quickActionSummarizePrompt:
        typeof quickActionSummarizePrompt === "string"
          ? quickActionSummarizePrompt
          : AI_DEFAULTS.quickActionPrompts.quickActionSummarizePrompt,
    },
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
    case "quickActionPrompts": {
      const prompts = value as AISettings["quickActionPrompts"];
      setPref("quickActionExplainPrompt", prompts.quickActionExplainPrompt);
      setPref("quickActionCritiquePrompt", prompts.quickActionCritiquePrompt);
      setPref("quickActionBulletizePrompt", prompts.quickActionBulletizePrompt);
      setPref("quickActionTranslatePrompt", prompts.quickActionTranslatePrompt);
      setPref("quickActionSummarizePrompt", prompts.quickActionSummarizePrompt);
      break;
    }
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
  saveAISetting("quickActionPrompts", AI_DEFAULTS.quickActionPrompts);
}

// ─── Presets ───────────────────────────────────────────────────────────────

export type AIPreset = {
  name: string;
  settings: AISettings;
};

export function isAISettings(value: unknown): value is AISettings {
  if (!value || typeof value !== "object") return false;
  const s = value as Partial<AISettings>;
  const prompts = s.quickActionPrompts as Record<string, unknown> | undefined;
  return (
    typeof s.provider === "string" &&
    typeof s.apiKey === "string" &&
    typeof s.baseURL === "string" &&
    typeof s.model === "string" &&
    typeof s.temperature === "number" &&
    typeof s.maxTokens === "number" &&
    typeof s.systemPrompt === "string" &&
    !!prompts &&
    typeof prompts.quickActionExplainPrompt === "string" &&
    typeof prompts.quickActionCritiquePrompt === "string" &&
    typeof prompts.quickActionBulletizePrompt === "string" &&
    typeof prompts.quickActionTranslatePrompt === "string" &&
    typeof prompts.quickActionSummarizePrompt === "string"
  );
}

export function isAIPreset(value: unknown): value is AIPreset {
  if (!value || typeof value !== "object") return false;
  const p = value as { name?: unknown; settings?: unknown };
  return typeof p.name === "string" && isAISettings(p.settings);
}

export function loadPresets(): AIPreset[] {
  const raw = getPref("aiPresets");
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter(isAIPreset);
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
  saveAISetting("quickActionPrompts", s.quickActionPrompts);
}
export type QuickActionPromptKey =
  | "quickActionExplainPrompt"
  | "quickActionCritiquePrompt"
  | "quickActionBulletizePrompt"
  | "quickActionTranslatePrompt"
  | "quickActionSummarizePrompt";
