import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import { streamAIReply, type AIChatMessage } from "../../modules/aiService";
import { getPref } from "../../utils/prefs";
import { loadAISettings } from "../../modules/aiPrefs";
import type { SidebarPanelData } from "../bridge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ChevronDown } from "lucide-react";

import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type SidebarPanelProps = {
  data: SidebarPanelData | null;
  showSelectedText?: boolean;
  selectedText: string;
  selectedAnnotation: _ZoteroTypes.Annotations.AnnotationJson | null;
};
type ChatRole = "assistant" | "user" | "system";
type ChatMessage = {
  id: string;
  role: ChatRole;
  text: string;
  meta?: string;
  thinking?: string;
  thoughtDuration?: number;
};
type ChatSession = {
  id: string;
  title: string;
  updatedAt: number;
  messages: ChatMessage[];
  draft: string;
  queuedSelection: string;
};
type PersistedState = {
  sessions: ChatSession[];
  activeSessionID: string;
  activeContext: SidebarPanelData | null;
};
type MarginMindChatWindow = Window & {
  __marginmindItemPaneChatState?: PersistedState;
};
const isAbortError = (error: unknown) =>
  error instanceof DOMException
    ? error.name === "AbortError"
    : error instanceof Error
      ? error.name === "AbortError" ||
        /aborted|cancelled|canceled/i.test(error.message)
      : false;

const PREVIEW_ID = "selection-preview";
const EMPTY_TITLE = "New chat";
const ROLE_LABEL: Record<ChatRole, string> = {
  assistant: "MarginMind",
  user: "You",
  system: "Selection",
};
const ROLE_BUBBLE: Record<ChatRole, string> = {
  system:
    "w-full border-[color-mix(in_srgb,var(--accent-blue)_35%,transparent)] border-solid bg-[color-mix(in_srgb,var(--accent-blue)_16%,transparent)] text-[13px] text-[color-mix(in_srgb,var(--fill-primary)_88%,transparent)]",
  assistant:
    "w-full border-[color-mix(in_srgb,var(--fill-primary)_16%,transparent)] border-solid bg-[color-mix(in_srgb,var(--material-sidepane)_84%,var(--fill-primary)_8%)] text-[var(--fill-primary)] text-[18px] leading-[30px]",
  user: "max-w-[80%] border-[color-mix(in_srgb,var(--accent-blue)_45%,transparent)] border-solid bg-[color-mix(in_srgb,var(--accent-blue)_20%,transparent)] text-[var(--fill-primary)] text-[18px] leading-[30px]",
};

const top_btn_style =
  " border-[1px] border-[color-mix(in_srgb,var(--fill-primary)_16%,transparent)] bg-[color-mix(in_srgb,var(--material-sidepane)_88%,var(--fill-primary)_8%)] px-2 text-[12px] text-[color-mix(in_srgb,var(--fill-primary)_78%,transparent)]";

const quick_btn_style =
  "rounded-full border-[1px] border-[color-mix(in_srgb,var(--fill-primary)_16%,transparent)] bg-[color-mix(in_srgb,var(--material-sidepane)_88%,var(--fill-primary)_8%)] px-2 text-[12px] text-[color-mix(in_srgb,var(--fill-primary)_78%,transparent)]";

// const THINKING_MODELS: Record<string, string> = {
//   "deepseek-chat": "deepseek-reasoner",
//   "deepseek-v3": "deepseek-reasoner",
//   "gemini-2.0-flash": "gemini-2.0-flash-thinking-exp",
//   "gemini-2.5-flash": "gemini-2.5-flash-preview-04-17-thinking",
//   "gemini-2.5-pro": "gemini-2.5-pro-preview-05-06",
// };

const PROMPTS_EN = {
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

const PROMPTS = {
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

// const QUICK_ACTIONS = [
//   {
//     id: "summarize",
//     label: "Summarize full text",
//     prompt: "Summarize the main points of this paper.",
//   },
//   {
//     id: "Critique",
//     label: "Critique selection",
//     prompt: "Critique the methodology and assumptions.",
//   },
//   {
//     id: "bulletize",
//     label: "Bulletize selection",
//     prompt: "Turn the selection into concise notes with bullets.",
//   },
// ] as const;

// const TRANSLATE_SELECTION_PROMPT =
//   "Translate the selected text to Chinese. Keep the terminology accurate and output only the translation.";

const uid = (p: string) => `${p}-${Date.now()}`;
const initialMessages = (): ChatMessage[] => [
  {
    id: "assistant-greeting",
    role: "assistant",
    text: "Your AI assistant is ready. Ask for summary, critique, extraction, or translation.",
    meta: "Ready",
  },
];
const createSession = (partial?: Partial<ChatSession>): ChatSession => ({
  id: partial?.id ?? uid("session"),
  title: partial?.title ?? EMPTY_TITLE,
  updatedAt: partial?.updatedAt ?? Date.now(),
  messages: partial?.messages ?? initialMessages(),
  draft: partial?.draft ?? "",
  queuedSelection: partial?.queuedSelection ?? "",
});
const toTime = (ts: number) => {
  const d = new Date(ts);
  const YYYY = d.getFullYear();
  const MM = String(d.getMonth() + 1).padStart(2, "0"); // 月份�?开始，需�?1
  const DD = String(d.getDate()).padStart(2, "0");
  const HH = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");

  return `${YYYY}-${MM}-${DD} ${HH}:${mm}`;
};
const trimTitle = (text: string, max = 42) => {
  const s = text.replace(/\s+/g, " ").trim();
  return !s ? EMPTY_TITLE : s.length > max ? `${s.slice(0, max)}...` : s;
};
const readPersisted = (): PersistedState | null =>
  (globalThis as unknown as MarginMindChatWindow)
    .__marginmindItemPaneChatState ?? null;
const writePersisted = (state: PersistedState) => {
  (
    globalThis as unknown as MarginMindChatWindow
  ).__marginmindItemPaneChatState = state;
};
const seedState = (data: SidebarPanelData | null): PersistedState => {
  const saved = readPersisted();
  if (!saved?.sessions?.length) {
    const first = createSession();
    return {
      sessions: [first],
      activeSessionID: first.id,
      activeContext: data,
    };
  }
  const activeExists = saved.sessions.some(
    (s) => s.id === saved.activeSessionID,
  );
  return {
    sessions: saved.sessions,
    activeSessionID: activeExists
      ? saved.activeSessionID
      : saved.sessions[0].id,
    activeContext: saved.activeContext ?? data,
  };
};
const buildSystemPrompt = (
  ctx: SidebarPanelData | null,
  systemPrompt: string,
) => {
  const lines = [
    "Paper context:",
    `Title: ${ctx?.title ?? "(none)"}`,
    `Creators: ${ctx?.creators ?? "(none)"}`,
    `Year: ${ctx?.year ?? "(none)"}`,
    `Key: ${ctx?.keyText ?? "(none)"}`,
    `Abstract: ${ctx?.abstractPreview ?? "(none)"}`,
  ];
  return `${systemPrompt}\n\n${lines.join("\n")}`;
};

const handleInternalJump = async (href: string) => {
  if (!href || !href.startsWith("zotero://")) return;

  try {
    const url = new URL(href);
    const itemKey = url.pathname.split("/").pop();
    const pageStr = url.searchParams.get("page");
    const regionStr = url.searchParams.get("region");

    // const region: number[] = regionStr?.split(",").map(Number) ?? [];
    // const regionArr: Array<number[]> = [region];
    const regionArr: Array<number[]> = JSON.parse(
      decodeURIComponent(regionStr as string) ?? "[]",
    ); // regionStr应当形如'[[48, 368.569, 299.997, 378.069], [48, 357.029, 299.997, 366.529], [48, 345.489, 299.997, 354.989], [48, 333.949, 255.356, 343.449]]'
    // const regionArr: Array<number[]> = [
    //   [48, 368.569, 299.997, 378.069],
    //   [48, 357.029, 299.997, 366.529],
    //   [48, 345.489, 299.997, 354.989],
    //   [48, 333.949, 255.356, 343.449],
    // ]; // 测试用

    /*
    [x1, y1, x2, y2]
    x1: 矩形左边界的坐标。
    y1: 矩形底边界（或顶边界，取决于坐标系）的坐标。
    x2: 矩形右边界的坐标。
    y2: 矩形顶边界（或底边界）的坐标。
    */

    const annotationKey = url.searchParams.get("annotation");

    const item: any = Zotero.Items.getByLibraryAndKey(
      Zotero.Libraries.userLibraryID,
      itemKey as string,
    );
    if (!item) throw new Error(`Item not found: ${itemKey}`);

    // pageIndex 是从 0 开始的，所以需要 -1
    const pageIndex = pageStr ? parseInt(pageStr, 10) - 1 : 0;
    const location: _ZoteroTypes.Reader.Location = {
      // pageIndex,
      position: { rects: regionArr, pageIndex: pageIndex },
    };

    const reader = await Zotero.Reader.open(item.id, location);

    // await reader?._initPromise;
    // await reader?.navigate(location);
    reader?.navigate(location); // 好像这样本身就能延迟跳转，不用上面两行
    // }
  } catch (err) {
    ztoolkit.log("Internal jump failed, falling back to launchURL", err);
    // 如果原生方法失败，作为保底再使用 launchURL，但这样会有系统弹窗
    Zotero.launchURL(href);
  }
};

function MessageContent({ message }: { message: ChatMessage }) {
  if (message.role !== "assistant") {
    return (
      <div data-render-mode="plain" className="whitespace-pre-wrap">
        {message.text}
      </div>
    );
  }

  return (
    <div>
      {message.thinking ? (
        <div data-thinking-section>
          <details open className="group mb-1.5">
            <summary className="cursor-pointer select-none text-[12px] font-medium tracking-wide text-[color-mix(in_srgb,var(--fill-primary)_42%,transparent)] hover:text-[color-mix(in_srgb,var(--fill-primary)_60%,transparent)]">
              {message.thoughtDuration != null
                ? `Thought for ${message.thoughtDuration} second${message.thoughtDuration === 1 ? "" : "s"}`
                : "Thinking"}
            </summary>
            <div className="mt-1 border-y-0 border-l-2 border-r-0 border-solid border-[color-mix(in_srgb,var(--fill-primary)_14%,transparent)] pl-3 text-[14px] leading-[24px] text-[color-mix(in_srgb,var(--fill-primary)_52%,transparent)] [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
              <Markdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex, rehypeHighlight]}
                urlTransform={(uri) =>
                  uri.startsWith("zotero://") ? uri : uri
                }
                components={{
                  pre: ({ ...props }) => (
                    <pre
                      {...props}
                      className={cn("whitespace-pre-wrap", props.className)}
                    />
                  ),
                }}
              >
                {message.thinking}
              </Markdown>
            </div>
          </details>
        </div>
      ) : null}
      {/* <div className="select-text text-[20px] leading-[32px]"> */}
      {/* 解决markdown首末边距过大的问题 */}
      <div className="[&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
        <Markdown
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[rehypeKatex, rehypeHighlight]}
          // 关键修复：放行 zotero 协议，防止被react-markdown过滤
          urlTransform={(uri) => (uri.startsWith("zotero://") ? uri : uri)}
          components={{
            a: ({ href, ...props }) => (
              <a
                {...props}
                // href={href} // 可以直接内部跳转，也没有blank弹窗，但是不够强大
                // target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  e.preventDefault();
                  if (!href) return;
                  if (href.startsWith("zotero://")) {
                    handleInternalJump(href);
                    // Zotero.openInViewer(href); // 可以内部跳转，但是有blank弹窗，且无法高亮
                  } else {
                    Zotero.launchURL(href);
                  }
                }}
              />
            ),
            pre: ({ ...props }) => (
              <pre
                {...props}
                className={cn("whitespace-pre-wrap", props.className)}
              />
            ),
          }}
        >
          {message.text}
        </Markdown>
      </div>
    </div>
  );
}

export function SidebarPanel({
  data,
  showSelectedText = false,
  selectedText,
  selectedAnnotation,
}: SidebarPanelProps) {
  const seeded = useMemo(() => seedState(data), []);
  const [sessions, setSessions] = useState<ChatSession[]>(seeded.sessions);
  const [activeSessionID, setActiveSessionID] = useState(
    seeded.activeSessionID,
  );
  const [activeContext, setActiveContext] = useState<SidebarPanelData | null>(
    seeded.activeContext ?? data ?? null,
  );
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [showJump, setShowJump] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIDs, setSelectedIDs] = useState<string[]>([]);
  const [isSavingAnnotation, setIsSavingAnnotation] = useState(false);

  const selectionSigRef = useRef("");
  const messageRef = useRef<HTMLDivElement | null>(null);
  const autoScrollRef = useRef(true);
  const forceScrollRef = useRef(false);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const thinkingStartRef = useRef<number | null>(null);

  const settings = loadAISettings();
  const annotationColor = getPref("annotationColor");
  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeSessionID) ?? sessions[0],
    [sessions, activeSessionID],
  );
  const messages = activeSession?.messages ?? [];
  const draft = activeSession?.draft ?? "";
  const queuedSelection = activeSession?.queuedSelection ?? "";
  // const hasSelectionPreview = messages.some((m) => m.id === PREVIEW_ID);
  const contextSummary = activeContext
    ? `${activeContext.title} · ${activeContext.creators} · ${activeContext.year}`
    : "No active item context";
  const contextTooltip = activeContext
    ? `${activeContext.title} / ${activeContext.creators} / ${activeContext.year} / ${activeContext.keyText}`
    : "No active item context";
  const canSaveToAnnotation =
    !!queuedSelection.trim() &&
    !!selectedAnnotation &&
    !!activeContext?.attachmentItemID &&
    selectedIDs.length > 0 &&
    !isSavingAnnotation;
  const canDeleteSelected = selectedIDs.length > 0 && !isSending;

  const patchSession = (id: string, fn: (s: ChatSession) => ChatSession) =>
    setSessions((curr) =>
      curr.map((s) => (s.id === id ? { ...fn(s), updatedAt: Date.now() } : s)),
    );
  const patchActive = (fn: (s: ChatSession) => ChatSession) => {
    if (activeSession) patchSession(activeSession.id, fn);
  };
  const clearSelectionMode = () => {
    setIsSelectionMode(false);
    setSelectedIDs([]);
  };
  const showError = (text: string, ms = 5000) => {
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    setRequestError(text);
    errorTimerRef.current = setTimeout(() => setRequestError(""), ms);
  };

  const updateDraft = (next: string) =>
    patchActive((s) => ({ ...s, draft: next }));
  const insertSelectionToDraft = () => {
    if (!queuedSelection) return;
    updateDraft(
      draft.trim()
        ? `${draft.trim()}\n\n[Selected text]\n${queuedSelection}`
        : `[Selected text]\n${queuedSelection}`,
    );
  };
  const clearQueuedSelection = () => {
    selectionSigRef.current = "";
    patchActive((s) => ({
      ...s,
      queuedSelection: "",
      messages: s.messages.filter((m) => m.id !== PREVIEW_ID),
    }));
  };
  // const translateSelection = async () => {
  //   const target = queuedSelection.trim();
  //   if (!target) {
  //     showError("No selected text to translate.");
  //     return;
  //   }
  //   const hasPreview = activeSession?.messages.some((m) => m.id === PREVIEW_ID);
  //   if (hasPreview) {
  //     await send(TRANSLATE_SELECTION_PROMPT);
  //     return;
  //   }
  //   await send(
  //     `${TRANSLATE_SELECTION_PROMPT}\n\n[Selected text from paper]\n${target}`,
  //   );
  // };
  const clearDraft = () => updateDraft("");
  const stopSending = () => {
    abortControllerRef.current?.abort();
  };
  const createNewSession = () => {
    const n = createSession();
    setSessions((curr) => [n, ...curr]);
    setActiveSessionID(n.id);
    setRequestError("");
    selectionSigRef.current = "";
    clearSelectionMode();
  };
  const jumpToLatest = () => {
    const el = messageRef.current;
    if (!el) return;
    autoScrollRef.current = true;
    setShowJump(false);
    el.scrollTop = el.scrollHeight;
  };
  const toggleSelected = (id: string) =>
    setSelectedIDs((curr) =>
      curr.includes(id) ? curr.filter((x) => x !== id) : [...curr, id],
    );
  const toggleSelectionWithAnyClick = (id: string) => {
    if (!isSelectionMode) {
      setIsSelectionMode(true);
      setSelectedIDs([id]);
      return;
    }
    toggleSelected(id);
  };

  const normalizePrompt = (input: string, base: ChatMessage[]) => {
    const text = input.trim();
    if (!text) return null;
    const previewIndex = base.findIndex((m) => m.id === PREVIEW_ID);
    if (previewIndex === -1) {
      return {
        text,
        messages: [...base, { id: uid("user"), role: "user" as const, text }],
      };
    }
    const merged = `${text}\n\n[Selected text from paper]\n${base[previewIndex].text}`;
    const next = [...base];
    next[previewIndex] = { id: uid("user"), role: "user", text: merged };
    return { text: merged, messages: next };
  };

  async function send(prompt: string) {
    if (!activeSession || isSending) return;
    const norm = normalizePrompt(prompt, activeSession.messages);
    if (!norm) return;
    forceScrollRef.current = true;

    const sessionID = activeSession.id;
    patchSession(sessionID, (s) => ({
      ...s,
      title: s.title === EMPTY_TITLE ? trimTitle(norm.text) : s.title,
      messages: norm.messages,
      draft: "",
      queuedSelection: "",
    }));

    setIsSending(true);
    setRequestError("");
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const assistantID = uid("assistant");
    patchSession(sessionID, (s) => ({
      ...s,
      messages: [
        ...s.messages,
        {
          id: assistantID,
          role: "assistant",
          text: "",
          meta: `${settings.provider} / ${settings.model}`,
        },
      ],
    }));

    try {
      const apiMessages: AIChatMessage[] = [
        {
          role: "system",
          content: buildSystemPrompt(activeContext, settings.systemPrompt),
        },
        ...norm.messages
          .filter(
            (m): m is ChatMessage & { role: "assistant" | "user" } =>
              m.role !== "system",
          )
          .map((m) => ({ role: m.role, content: m.text })),
      ];
      let full = "";
      let thinking = "";
      let streamError: unknown = null;
      thinkingStartRef.current = null;
      const stream = streamAIReply({
        settings,
        messages: apiMessages,
        abortSignal: controller.signal,
      });

      for await (const chunk of stream) {
        if (chunk.type === "thinking") {
          if (thinkingStartRef.current === null) {
            thinkingStartRef.current = Date.now();
          }
          thinking += chunk.content;
        } else {
          full += chunk.content;
        }
        patchSession(sessionID, (s) => ({
          ...s,
          messages: s.messages.map((m) =>
            m.id === assistantID
              ? {
                  ...m,
                  text: full,
                  thinking: thinking || undefined,
                }
              : m,
          ),
        }));
      }

      if (thinkingStartRef.current !== null) {
        const duration = Math.max(
          1,
          Math.round((Date.now() - thinkingStartRef.current) / 1000),
        );
        patchSession(sessionID, (s) => ({
          ...s,
          messages: s.messages.map((m) =>
            m.id === assistantID ? { ...m, thoughtDuration: duration } : m,
          ),
        }));
      }

      if (!full.trim()) {
        streamError = new Error(
          "Model returned an empty response. Check provider/model/API key or try again.",
        );
      }

      if (streamError) {
        throw streamError;
      }
    } catch (error) {
      if (isAbortError(error)) return;
      const msg = error instanceof Error ? error.message : "Request failed.";
      showError(msg);
      patchSession(sessionID, (s) => ({
        ...s,
        messages: [
          ...s.messages,
          {
            id: uid("assistant-error"),
            role: "assistant",
            text: `Request failed: ${msg}`,
            meta: "Error",
          },
        ],
      }));
    } finally {
      abortControllerRef.current = null;
      setIsSending(false);
    }
  }

  const handleDraftKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey) return;
    if (event.nativeEvent.isComposing) return;
    event.preventDefault();
    if (isSelectionMode || (!isSending && !draft.trim())) return;
    if (isSending) {
      stopSending();
      return;
    }
    void send(draft);
  };

  async function saveSelectionAsAnnotation() {
    if (
      !canSaveToAnnotation ||
      !selectedAnnotation ||
      !activeContext?.attachmentItemID
    )
      return;
    setIsSavingAnnotation(true);
    setRequestError("");
    try {
      const attachment = Zotero.Items.get(activeContext.attachmentItemID) as
        | Zotero.Item
        | undefined;
      if (!attachment || !attachment.isAttachment())
        throw new Error("Attachment not found for annotation.");
      const comment = messages
        .filter((m) => selectedIDs.includes(m.id))
        .map((m) => `━━━━━━━━━━ ${m.role.toUpperCase()} ━━━━━━━━━━\n${m.text}`)
        .join("\n\n");

      const annotation = new Zotero.Item("annotation") as any;
      annotation.libraryID = attachment.libraryID;
      annotation.parentKey = attachment.key;
      annotation.annotationType = selectedAnnotation.type || "highlight";
      annotation.annotationPageLabel =
        selectedAnnotation.position.pageIndex + 1;
      annotation.annotationText = selectedAnnotation.text || "";
      annotation.annotationComment = comment;
      annotation.annotationColor = selectedAnnotation.color || annotationColor;
      annotation.annotationPosition = JSON.stringify({
        pageIndex: selectedAnnotation.position.pageIndex,
        rects: selectedAnnotation.position.rects || [],
      });
      annotation.annotationSortIndex =
        selectedAnnotation.sortIndex ||
        `00000|${Date.now().toString().padStart(6, "0")}|00000`;
      await annotation.saveTx();
      clearSelectionMode();
    } catch (error) {
      showError(
        error instanceof Error ? error.message : "Failed to save annotation.",
        2000,
      );
    } finally {
      setIsSavingAnnotation(false);
    }
  }

  function deleteSelectedMessages() {
    if (!activeSession || !canDeleteSelected) return;
    const selectedSet = new Set(selectedIDs);
    const deletingPreview = selectedSet.has(PREVIEW_ID);

    patchSession(activeSession.id, (s) => ({
      ...s,
      queuedSelection: deletingPreview ? "" : s.queuedSelection,
      messages: s.messages.filter((m) => !selectedSet.has(m.id)),
    }));

    if (deletingPreview) {
      selectionSigRef.current = "";
    }
    clearSelectionMode();
  }

  useEffect(() => {
    if (!sessions.length) {
      const f = createSession();
      setSessions([f]);
      setActiveSessionID(f.id);
      return;
    }
    if (!sessions.some((s) => s.id === activeSessionID))
      setActiveSessionID(sessions[0].id);
  }, [sessions, activeSessionID]);

  useEffect(() => {
    if (data) setActiveContext(data);
  }, [data]);

  useEffect(
    () => writePersisted({ sessions, activeSessionID, activeContext }),
    [sessions, activeSessionID, activeContext],
  );

  useEffect(
    () => () => {
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    const list = messageRef.current;
    if (!list) return;

    if (forceScrollRef.current) {
      list.scrollTop = list.scrollHeight;
      forceScrollRef.current = false;
      return;
    }

    if (autoScrollRef.current) {
      list.scrollTop = list.scrollHeight;
    }
  }, [messages, isSending]);

  // 当消息发送完成（停止发送）时，自动折叠聊天界面中所有展开的“思考过程”区块。
  useEffect(() => {
    if (isSending) return;
    const list = messageRef.current;
    if (!list) return;
    list
      .querySelectorAll<HTMLDetailsElement>(
        "[data-thinking-section] > details[open]",
      )
      .forEach((el) => (el.open = false));
  }, [isSending]);

  useEffect(() => {
    const list = messageRef.current;
    if (!list) return;
    const onScroll = () => {
      const nearBottom =
        list.scrollHeight - list.scrollTop - list.clientHeight <= 256;
      autoScrollRef.current = nearBottom;
      setShowJump(!nearBottom);
    };
    onScroll();
    list.addEventListener("scroll", onScroll, { passive: true });
    return () => list.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!activeSession) return;
    if (!showSelectedText || !selectedText) {
      patchActive((s) => {
        if (!s.queuedSelection && !s.messages.some((m) => m.id === PREVIEW_ID))
          return s;
        return {
          ...s,
          queuedSelection: "",
          messages: s.messages.filter((m) => m.id !== PREVIEW_ID),
        };
      });
      return;
    }
    if (selectionSigRef.current === selectedText) return;
    selectionSigRef.current = selectedText;
    patchActive((s) => {
      const i = s.messages.findIndex((m) => m.id === PREVIEW_ID);
      const preview: ChatMessage = {
        id: PREVIEW_ID,
        role: "user",
        text: selectedText,
        meta: "Selection preview",
      };
      if (i === -1)
        return {
          ...s,
          queuedSelection: selectedText,
          messages: [...s.messages, preview],
        };
      const next = [...s.messages];
      next[i] = preview;
      return { ...s, queuedSelection: selectedText, messages: next };
    });
  }, [selectedText, showSelectedText, activeSessionID]);

  if (!activeContext && !messages.length) {
    return (
      <Card className="h-full rounded-xl border-[color-mix(in_srgb,var(--fill-primary)_16%,transparent)] bg-[var(--material-sidepane)] px-4 py-5 text-[var(--fill-primary)]">
        <CardTitle className="text-[16px]">No item selected</CardTitle>
        <CardDescription className="mt-1 text-[14px] text-[color-mix(in_srgb,var(--fill-primary)_58%,transparent)]">
          Select an item to open the assistant workspace.
        </CardDescription>
      </Card>
    );
  }

  const QUICK_ACTIONS = [
    // {
    //   id: "summarize",
    //   label: "Summarize full text",
    //   onClick: () => send("Summarize the main points of this paper."),
    // },
    {
      id: "explain",
      label: "Explain selection",
      onClick: () => send(PROMPTS.explainSelection),
    },
    {
      id: "critique",
      label: "Critique selection",
      onClick: () => send(PROMPTS.critiqueSelection),
    },
    {
      id: "bulletize",
      label: "Bulletize selection",
      onClick: () => send(PROMPTS.bulletizeSelection),
    },
    {
      id: "traslate",
      label: "Translate selection",
      onClick: () => send(PROMPTS.translateSelection),
    },
    {
      id: "insert",
      label: "Insert selection",
      onClick: insertSelectionToDraft,
    },
    {
      id: "clear",
      label: "Clear selection",
      onClick: clearQueuedSelection,
    },
  ] as const;

  return (
    <aside
      // className="flex h-full min-h-0 w-full flex-col overflow-hidden border border-solid border-[color-mix(in_srgb,var(--accent-blue)_40%,var(--fill-primary)_12%)] bg-[var(--material-sidepane)] text-[var(--fill-primary)]"
      className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-[var(--material-sidepane)] text-[var(--fill-primary)]"
    >
      <section className="space-y-2 p-2.5">
        <div className="flex items-center justify-between gap-1.5">
          <Button
            size="xs"
            variant="outline"
            onClick={() => setIsHistoryOpen((v) => !v)}
            className={top_btn_style}
          >
            {isHistoryOpen ? "Hide history" : "Show history"}
          </Button>
          <Button
            size="xs"
            variant="outline"
            onClick={createNewSession}
            disabled={isSending}
            className={top_btn_style}
          >
            New chat
          </Button>
        </div>

        {isHistoryOpen ? (
          <Card className="border-[color-mix(in_srgb,var(--fill-primary)_16%,transparent)] bg-[color-mix(in_srgb,var(--material-sidepane)_86%,var(--fill-primary)_8%)] p-1.5">
            <CardContent className="max-h-[240px] space-y-1.5 overflow-y-auto p-0 pr-1">
              {sessions
                .slice()
                .sort((a, b) => b.updatedAt - a.updatedAt)
                .map((session) => {
                  const active = session.id === activeSessionID;
                  return (
                    <button
                      key={session.id}
                      type="button"
                      disabled={isSending}
                      onClick={() => {
                        setActiveSessionID(session.id);
                        setIsHistoryOpen(false);
                        setRequestError("");
                        clearSelectionMode();
                      }}
                      className={cn(
                        "w-full rounded-lg border p-2 text-left transition",
                        active
                          ? "border-[color-mix(in_srgb,var(--accent-blue)_50%,transparent)] bg-[color-mix(in_srgb,var(--accent-blue)_20%,transparent)]"
                          : "border-[color-mix(in_srgb,var(--fill-primary)_16%,transparent)] bg-[color-mix(in_srgb,var(--material-sidepane)_82%,var(--fill-primary)_8%)] hover:bg-[color-mix(in_srgb,var(--material-sidepane)_78%,var(--fill-primary)_12%)]",
                      )}
                    >
                      <div className="line-clamp-1 pr-1 text-[13px] font-medium text-[var(--fill-primary)]">
                        {session.title}
                      </div>
                      <div className="mt-3 flex justify-between text-[12px] text-[color-mix(in_srgb,var(--fill-primary)_56%,transparent)]">
                        <span>{toTime(session.updatedAt)}</span>
                        <span>{session.messages.length} messages</span>
                      </div>
                    </button>
                  );
                })}
            </CardContent>
          </Card>
        ) : null}

        <div
          title={contextTooltip}
          className="flex items-center gap-1.5 rounded-md border border-[color-mix(in_srgb,var(--fill-primary)_16%,transparent)] bg-[color-mix(in_srgb,var(--material-sidepane)_88%,var(--fill-primary)_7%)] p-2 text-[12px] text-[color-mix(in_srgb,var(--fill-primary)_60%,transparent)]"
        >
          <span className="shrink-0 font-semibold uppercase tracking-wide text-[color-mix(in_srgb,var(--fill-primary)_44%,transparent)]">
            CONTEXT
          </span>
          {/* <span className="min-w-0 truncate">{contextSummary}</span> */}
          <span className="line-clamp-1 min-w-0">{contextSummary}</span>
        </div>
      </section>

      <section
        ref={messageRef}
        className="relative flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-2.5 pb-2.5"
      >
        {messages.map((message) => (
          <div
            key={message.id}
            className={
              isSelectionMode ? "cursor-pointer select-none" : "select-text"
            }
            onContextMenu={(event) => {
              event.preventDefault();
              toggleSelectionWithAnyClick(message.id);
            }}
            onClick={() => {
              if (!isSelectionMode) return;
              toggleSelected(message.id);
            }}
          >
            <div
              className={cn(
                "flex",
                message.role === "user" ? "justify-end" : "justify-start",
              )}
            >
              <Card
                className={cn(
                  "relative rounded-2xl px-3 py-2",
                  ROLE_BUBBLE[message.role],
                  isSelectionMode ? "select-none" : "select-text",
                  isSelectionMode && selectedIDs.includes(message.id)
                    ? "ring-2 ring-[color-mix(in_srgb,var(--accent-blue)_62%,transparent)]"
                    : "",
                )}
              >
                {isSelectionMode ? (
                  <input
                    type="checkbox"
                    checked={selectedIDs.includes(message.id)}
                    readOnly
                    className="absolute right-2 top-2 h-4 w-4 accent-[var(--accent-blue)]"
                  />
                ) : null}
                <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[color-mix(in_srgb,var(--fill-primary)_48%,transparent)]">
                  <span>{ROLE_LABEL[message.role]}</span>
                  {message.meta ? (
                    <span className="text-[color-mix(in_srgb,var(--fill-primary)_36%,transparent)]">
                      {message.meta}
                    </span>
                  ) : null}
                </div>
                <MessageContent message={message} />
              </Card>
            </div>
          </div>
        ))}

        {isSending ? (
          <div className="text-sm text-[color-mix(in_srgb,var(--fill-primary)_60%,transparent)]">
            Answering...
          </div>
        ) : null}
        {showJump ? (
          <Button
            // type="button"
            size="icon"
            // variant="outline"
            onClick={jumpToLatest}
            className="sticky bottom-0 right-2 ml-auto rounded-full border-[1px] border-[color-mix(in_srgb,var(--fill-primary)_18%,transparent)] bg-[color-mix(in_srgb,var(--material-sidepane)_72%,var(--fill-primary)_16%)] p-3 text-[color-mix(in_srgb,var(--fill-primary)_84%,transparent)]"
          >
            <ChevronDown />
          </Button>
        ) : null}
      </section>

      <section className="space-y-2 border-t border-[color-mix(in_srgb,var(--fill-primary)_16%,transparent)] p-2.5">
        <div className="flex flex-wrap gap-1.5">
          <Button
            size="xs"
            variant="outline"
            onClick={() => send(PROMPTS.summarizeFullText)}
            disabled={isSending || isSelectionMode}
            className={quick_btn_style}
          >
            Summarize
          </Button>
          {QUICK_ACTIONS.map((a) => (
            <Button
              key={a.id}
              size="xs"
              variant="outline"
              onClick={a.onClick}
              disabled={isSending || isSelectionMode || !queuedSelection.trim()}
              className={quick_btn_style}
            >
              {a.label}
            </Button>
          ))}
          {/* <Button
            size="xs"
            variant="outline"
            onClick={translateSelection}
            disabled={isSending || isSelectionMode || !queuedSelection.trim()}
            className="rounded-full border-[color-mix(in_srgb,var(--fill-primary)_16%,transparent)] bg-[color-mix(in_srgb,var(--material-sidepane)_88%,var(--fill-primary)_8%)] px-2 text-[12px] text-[color-mix(in_srgb,var(--fill-primary)_78%,transparent)]"
          >
            Translate selection
          </Button>
          <Button
            size="xs"
            variant="outline"
            onClick={insertSelectionToDraft}
            disabled={isSending || isSelectionMode || !queuedSelection.trim()}
            className="rounded-full border-[color-mix(in_srgb,var(--fill-primary)_16%,transparent)] bg-[color-mix(in_srgb,var(--material-sidepane)_88%,var(--fill-primary)_8%)] px-2 text-[12px] text-[color-mix(in_srgb,var(--fill-primary)_78%,transparent)]"
          >
            Insert selection
          </Button>
          <Button
            size="xs"
            variant="outline"
            onClick={clearQueuedSelection}
            disabled={isSending || isSelectionMode || !hasSelectionPreview}
            className="rounded-full border-[color-mix(in_srgb,var(--fill-primary)_16%,transparent)] bg-[color-mix(in_srgb,var(--material-sidepane)_88%,var(--fill-primary)_8%)] px-2 text-[12px] text-[color-mix(in_srgb,var(--fill-primary)_78%,transparent)]"
          >
            Clear selection
          </Button> */}
        </div>

        {isSelectionMode ? (
          // <Card className="border-[color-mix(in_srgb,var(--fill-primary)_16%,transparent)] bg-[color-mix(in_srgb,var(--material-sidepane)_86%,var(--fill-primary)_8%)] px-2.5 py-1.5">
          <Card className="border-[color-mix(in_srgb,var(--fill-primary)_16%,transparent)] bg-red-500/20 px-2.5 py-1.5">
            <CardContent className="flex items-center justify-between p-0">
              <div className="text-[13px] text-[color-mix(in_srgb,var(--fill-primary)_72%,transparent)]">
                Selected {selectedIDs.length} message
                {selectedIDs.length === 1 ? "" : "s"}
              </div>
              <div className="">
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  onClick={saveSelectionAsAnnotation}
                  disabled={!canSaveToAnnotation}
                  className="h-7 border-[color-mix(in_srgb,var(--fill-primary)_16%,transparent)] bg-transparent px-2 text-[12px] text-[color-mix(in_srgb,var(--fill-primary)_82%,transparent)]"
                  title={
                    queuedSelection.trim()
                      ? "Create annotation with selected messages in comment"
                      : "Select text in reader first"
                  }
                >
                  {isSavingAnnotation ? "Saving..." : "Save to annotation"}
                </Button>
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  onClick={deleteSelectedMessages}
                  disabled={!canDeleteSelected}
                  className="h-7 border-[color-mix(in_srgb,var(--fill-primary)_16%,transparent)] bg-transparent px-2 text-[12px] text-[color-mix(in_srgb,var(--fill-primary)_82%,transparent)]"
                >
                  Delete selected
                </Button>
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  onClick={clearSelectionMode}
                  className="h-7 border-[color-mix(in_srgb,var(--fill-primary)_16%,transparent)] bg-transparent px-2 text-[12px] text-[color-mix(in_srgb,var(--fill-primary)_82%,transparent)]"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <Card className="border-[color-mix(in_srgb,var(--fill-primary)_16%,transparent)] bg-[color-mix(in_srgb,var(--material-sidepane)_90%,var(--fill-primary)_7%)] p-2.5">
          <CardContent className="space-y-2 overflow-hidden p-0">
            <Textarea
              rows={3}
              placeholder="Ask about the paper..."
              value={draft}
              onChange={(e) => updateDraft(e.target.value)}
              onKeyDown={handleDraftKeyDown}
              disabled={isSending || isSelectionMode}
              className="resize-none border-[color-mix(in_srgb,var(--fill-primary)_16%,transparent)] bg-transparent text-[14px] leading-6 text-[var(--fill-primary)] placeholder:text-[color-mix(in_srgb,var(--fill-primary)_38%,transparent)]"
            />

            <Separator className="bg-[color-mix(in_srgb,var(--fill-primary)_12%,transparent)]" />

            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1.5">
                <Badge
                  variant="outline"
                  className="border-[color-mix(in_srgb,var(--fill-primary)_16%,transparent)] px-1.5 py-0 text-[12px] text-[color-mix(in_srgb,var(--fill-primary)_68%,transparent)]"
                >
                  {settings.provider}
                </Badge>
                <Badge
                  variant="outline"
                  className="border-[color-mix(in_srgb,var(--fill-primary)_16%,transparent)] px-1.5 py-0 text-[12px] text-[color-mix(in_srgb,var(--fill-primary)_68%,transparent)]"
                >
                  {settings.model}
                </Badge>
              </div>
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={clearDraft}
                disabled={isSelectionMode || !draft.trim() || isSending}
                className="h-7 border-[color-mix(in_srgb,var(--fill-primary)_16%,transparent)] bg-[color-mix(in_srgb,var(--material-sidepane)_88%,var(--fill-primary)_8%)] px-2.5 text-[12px] text-[color-mix(in_srgb,var(--fill-primary)_82%,transparent)]"
              >
                Clear
              </Button>
              <Button
                onClick={isSending ? stopSending : () => send(draft)}
                disabled={isSelectionMode || (!isSending && !draft.trim())}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-[13px] font-semibold",
                  isSending
                    ? "border-[color-mix(in_srgb,var(--accent-red,#d14)_55%,transparent)] bg-[color-mix(in_srgb,var(--accent-red,#d14)_72%,var(--material-sidepane)_28%)] text-[var(--fill-primary-inverse,var(--fill-primary))]"
                    : "border-[color-mix(in_srgb,var(--accent-blue)_55%,transparent)] bg-[color-mix(in_srgb,var(--accent-blue)_82%,var(--material-sidepane)_18%)] text-[var(--fill-primary-inverse,var(--fill-primary))]",
                )}
              >
                {isSending ? "Stop" : "Send"}
              </Button>
            </div>

            {requestError ? (
              <div className="text-[13px] text-[var(--accent-red,#d14)]">
                {requestError}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </section>
    </aside>
  );
}
