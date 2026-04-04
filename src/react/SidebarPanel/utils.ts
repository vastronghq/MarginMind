import type { ChatSession } from "./hooks/useChatSession";

export const uid = (p: string) => `${p}-${Date.now()}`;

export const EMPTY_TITLE = "New chat";

export const ROLE_LABEL: Record<string, string> = {
  assistant: "MarginMind",
  user: "You",
};

export const toTime = (ts: number) => {
  const d = new Date(ts);
  const MM = String(d.getMonth() + 1).padStart(2, "0");
  const DD = String(d.getDate()).padStart(2, "0");
  const HH = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");

  return `${MM}-${DD} ${HH}:${mm}`;
};

export const createSession = (partial?: Partial<ChatSession>): ChatSession => ({
  id: partial?.id ?? uid("session"),
  title: partial?.title ?? EMPTY_TITLE,
  updatedAt: partial?.updatedAt ?? Date.now(),
  messages: partial?.messages ?? [],
  draft: partial?.draft ?? "",
});

export const trimTitle = (text: string) => {
  const s = text.replace(/\s+/g, " ").trim();
  return !s ? EMPTY_TITLE : s;
};

export const truncateMiddle = (
  text: string,
  headLength: number,
  tailLength: number,
): string => {
  if (text.length <= headLength + tailLength) return text;

  const head = text.slice(0, headLength);
  const tail = text.slice(-tailLength);
  const omittedCount = text.length - head.length - tail.length;

  const result = `${head}

> *✂️ [${omittedCount.toLocaleString()} characters omitted from preview] ✂️*
> *🤖 Full text has been passed to AI 🤖*

${tail}`;

  return result;
};

export const isAbortError = (error: unknown): boolean =>
  error instanceof DOMException
    ? error.name === "AbortError"
    : error instanceof Error
      ? error.name === "AbortError" ||
        /aborted|cancelled|canceled/i.test(error.message)
      : false;

export const PROMPTS_EN = {
  summarizeFullText:
    "Summarize the core problem this paper addresses, its main methodology and thesis, and the key findings. Emphasize the unique contribution to the field and specify the research gap the authors aim to fill.",
  critiqueFullText: "",
  explainSelection:
    "Explain the selected text as a term or concept. Provide a clear definition, explain its significance in the context of academic literature, and include an example if helpful.",
  critiqueSelection:
    "Critique the assumptions, methodology, and arguments of the selected text, highlighting any weaknesses, unexamined premises, and strained interpretations.",
  bulletizeSelection: "Bulletize the selected text with concise, clear points.",
  translateSelection:
    "Translate the following into Chinese using formal academic nomenclature. Ensure technical terms align with standard terminology in Deep Learning/Biology/Computer Science. Output only the translation, maintaining a professional and objective tone.",
};

export const PROMPTS = {
  summarizeFullText:
    "总结本文所解决的核心问题、主要方法论和论点，以及关键发现。着重阐述该研究在领域内的独特贡献，并明确作者旨在填补的研究空白。",
  critiqueFullText: "",

  explainSelection:
    "请你作为本对话领域的专家，先拆解选文中的专业术语与概念，给出它们的定义（如涉及交叉学科，请剥离交叉部分，还原其在原学科中的定义）；再结合选文所处的学科背景，将这些概念串联起来，阐述选文的具体含义。",
  critiqueSelection:
    "对所选文本的假设、方法论和论证进行批判性分析，指出其中的不足之处、未经检验的前提以及牵强的解读。",
  bulletizeSelection: "将所选文本提炼为要点，每条要点保持简洁、清晰。",
  translateSelection:
    "使用规范的学术术语将以下内容翻译成【中文】。确保技术术语符合【计算机科学/化学/生物学/人工智能】领域的标准表述。重要术语保留英文原文，并在括号内附上【中文】翻译。仅输出翻译结果，保持专业、客观的语气。",
};

export const getContextSummary = (
  data: { title?: string; creators?: string; year?: string } | null,
): string => {
  if (!data) return "No active item context";
  return `${data.title} · ${data.creators} · ${data.year}`;
};

export const getContextTooltip = (
  data: {
    title?: string;
    creators?: string;
    year?: string;
    keyText?: string;
  } | null,
): string => {
  if (!data) return "No active item context";
  return `${data.title} / ${data.creators} / ${data.year} / ${data.keyText}`;
};
