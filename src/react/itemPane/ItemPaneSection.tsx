import { useEffect, useMemo, useRef, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import { streamAIReply, type AIChatMessage } from "../../modules/aiService";
import { loadAISettings } from "../../utils/aiPrefs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type ItemPaneData = {
  itemID: number | null;
  attachmentItemID: number | null;
  title: string;
  creators: string;
  year: string;
  abstractPreview: string;
  keyText: string;
};
type ItemPaneSectionProps = {
  data: ItemPaneData | null;
  showSelectedText?: boolean;
  selectedText: string;
  selectedAnnotation: _ZoteroTypes.Annotations.AnnotationJson | null;
};
type ChatRole = "assistant" | "user" | "system";
type ChatMessage = { id: string; role: ChatRole; text: string; meta?: string };
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
  activeContext: ItemPaneData | null;
};
type InSituAIChatWindow = Window & {
  __insituaiItemPaneChatState?: PersistedState;
};

const PREVIEW_ID = "selection-preview";
const EMPTY_TITLE = "New chat";
const ROLE_LABEL: Record<ChatRole, string> = {
  assistant: "InSitu",
  user: "You",
  system: "Selection",
};
const ROLE_BUBBLE: Record<ChatRole, string> = {
  system: "border-blue-400/30 bg-blue-500/10 text-[13px] text-white/80",
  assistant:
    "border-white/10 bg-white/5 text-[14px] text-[var(--fill-primary)]",
  user: "border-blue-400/40 bg-blue-500/20 text-[14px] text-[var(--fill-primary)]",
};
const QUICK_ACTIONS = [
  {
    id: "sum",
    label: "Summarize",
    prompt: "Summarize the main points of this paper.",
  },
  {
    id: "crit",
    label: "Critique",
    prompt: "Critique the methodology and assumptions.",
  },
  {
    id: "notes",
    label: "To notes",
    prompt: "Turn the selection into concise notes with bullets.",
  },
] as const;

const uid = (p: string) => `${p}-${Date.now()}`;
const initialMessages = (): ChatMessage[] => [
  {
    id: "assistant-greeting",
    role: "assistant",
    text: "AI chat is ready. Ask for summary, critique, extraction, or rewrite.",
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
  const MM = String(d.getMonth() + 1).padStart(2, "0"); // 月份从0开始，需要+1
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
  (globalThis as unknown as InSituAIChatWindow).__insituaiItemPaneChatState ??
  null;
const writePersisted = (state: PersistedState) => {
  (globalThis as unknown as InSituAIChatWindow).__insituaiItemPaneChatState =
    state;
};
const seedState = (data: ItemPaneData | null): PersistedState => {
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
const buildSystemPrompt = (ctx: ItemPaneData | null, systemPrompt: string) => {
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

function MessageContent({ message }: { message: ChatMessage }) {
  if (message.role !== "assistant") {
    return (
      <div data-render-mode="plain" className="text-[14px] leading-6">
        {message.text}
      </div>
    );
  }

  return (
    <div className="text-[14px] leading-6">
      <Markdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex, rehypeHighlight]}
        components={{
          a: ({ ...props }) => (
            <a {...props} target="_blank" rel="noopener noreferrer" />
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
  );
}

export function ItemPaneSection({
  data,
  showSelectedText = false,
  selectedText,
  selectedAnnotation,
}: ItemPaneSectionProps) {
  const seeded = useMemo(() => seedState(data), []);
  const [sessions, setSessions] = useState<ChatSession[]>(seeded.sessions);
  const [activeSessionID, setActiveSessionID] = useState(
    seeded.activeSessionID,
  );
  const [activeContext, setActiveContext] = useState<ItemPaneData | null>(
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
  const asideRef = useRef<HTMLElement | null>(null);
  const messageRef = useRef<HTMLDivElement | null>(null);
  const autoScrollRef = useRef(true);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggeredRef = useRef(false);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const settings = loadAISettings();
  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeSessionID) ?? sessions[0],
    [sessions, activeSessionID],
  );
  const messages = activeSession?.messages ?? [];
  const draft = activeSession?.draft ?? "";
  const queuedSelection = activeSession?.queuedSelection ?? "";
  const canSaveToAnnotation =
    !!queuedSelection.trim() &&
    !!selectedAnnotation &&
    !!activeContext?.attachmentItemID &&
    selectedIDs.length > 0 &&
    !isSavingAnnotation;

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
  const startLongPress = (id: string) => {
    if (isSelectionMode) return;
    longPressTriggeredRef.current = false;
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true;
      setIsSelectionMode(true);
      setSelectedIDs([id]);
    }, 420);
  };
  const stopLongPress = () => {
    if (!longPressTimerRef.current) return;
    clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = null;
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
      for await (const delta of streamAIReply({
        settings,
        messages: apiMessages,
      })) {
        full += delta;
        patchSession(sessionID, (s) => ({
          ...s,
          messages: s.messages.map((m) =>
            m.id === assistantID ? { ...m, text: full } : m,
          ),
        }));
      }
      if (!full.trim()) {
        patchSession(sessionID, (s) => ({
          ...s,
          messages: s.messages.map((m) =>
            m.id === assistantID ? { ...m, text: "(empty response)" } : m,
          ),
        }));
      }
    } catch (error) {
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
      setIsSending(false);
    }
  }

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
      annotation.annotationColor = selectedAnnotation.color || "#ffd400";
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
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    const aside = asideRef.current;
    if (!aside) return;
    const onWheel = (e: WheelEvent) => {
      const el = (e.target as Element)?.closest(
        '[data-can-scroll="true"]',
      ) as HTMLElement | null;
      if (!el) {
        e.preventDefault();
        return;
      }
      const atTop = e.deltaY < 0 && el.scrollTop <= 0;
      const atBottom =
        e.deltaY > 0 && el.scrollTop + el.clientHeight >= el.scrollHeight;
      if (atTop || atBottom) e.preventDefault();
      e.stopPropagation();
    };
    aside.addEventListener("wheel", onWheel, { passive: false });
    return () => aside.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    const list = messageRef.current;
    if (list && autoScrollRef.current) list.scrollTop = list.scrollHeight;
  }, [messages, isSending]);

  useEffect(() => {
    const list = messageRef.current;
    if (!list) return;
    const onScroll = () => {
      const nearBottom =
        list.scrollHeight - list.scrollTop - list.clientHeight <= 48;
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
      <Card className="h-full rounded-xl border-white/10 bg-[var(--material-sidepane)] px-4 py-5 text-[var(--fill-primary)]">
        <CardTitle className="text-[16px]">No item selected</CardTitle>
        <CardDescription className="mt-1 text-[14px] text-white/55">
          Select an item to open the assistant workspace.
        </CardDescription>
      </Card>
    );
  }

  return (
    <aside
      ref={asideRef}
      className="flex max-h-[80vh] min-h-0 w-full flex-col overflow-hidden border border-[var(--accent-blue)] bg-[var(--material-sidepane)] text-[var(--fill-primary)]"
    >
      <section className="space-y-2 p-2.5">
        <div className="flex items-center justify-between gap-1.5">
          <Button
            size="xs"
            variant="outline"
            onClick={() => setIsHistoryOpen((v) => !v)}
            className="h-7 border-white/15 bg-black/20 px-2 text-[12px] text-[var(--fill-primary)]"
          >
            {isHistoryOpen ? "Hide history" : "Show history"}
          </Button>
          <Button
            size="xs"
            variant="outline"
            onClick={createNewSession}
            disabled={isSending}
            className="h-7 border-white/15 bg-black/20 px-2 text-[12px] text-[var(--fill-primary)]"
          >
            New chat
          </Button>
        </div>

        {isHistoryOpen ? (
          <Card className="border-white/10 bg-black/20 p-1.5">
            <CardContent
              data-can-scroll="true"
              className="max-h-[240px] space-y-1.5 overflow-y-auto p-0 pr-1"
            >
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
                          ? "border-blue-400/45 bg-blue-500/15"
                          : "border-white/10 bg-black/20 hover:bg-white/5",
                      )}
                    >
                      <div className="truncate pr-1 text-[13px] font-medium text-[var(--fill-primary)]">
                        {session.title}
                      </div>
                      <div className="mt-3 flex justify-between text-[12px] text-white/50">
                        <span>{toTime(session.updatedAt)}</span>
                        <span>{session.messages.length} messages</span>
                      </div>
                    </button>
                  );
                })}
            </CardContent>
          </Card>
        ) : null}

        <Card className="border-white/10 bg-black/10 text-white/70">
          <CardHeader className="pb-1.5">
            <CardTitle className="text-[12px] font-bold uppercase tracking-wide text-white/40">
              Context
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-[13px] leading-relaxed text-white/65">
            {activeContext
              ? `${activeContext.title} / ${activeContext.creators} / ${activeContext.year} / ${activeContext.keyText}`
              : "No active item context"}
          </CardContent>
        </Card>
      </section>

      <section
        data-can-scroll="true"
        ref={messageRef}
        className="relative flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-2.5 pb-2.5"
      >
        {messages.map((message) => (
          <div
            key={message.id}
            className={isSelectionMode ? "cursor-pointer select-none" : ""}
            onPointerDown={() => startLongPress(message.id)}
            onPointerUp={stopLongPress}
            onPointerLeave={stopLongPress}
            onPointerCancel={stopLongPress}
            onClick={() => {
              if (!isSelectionMode) return;
              if (longPressTriggeredRef.current) {
                longPressTriggeredRef.current = false;
                return;
              }
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
                  "relative max-w-[92%] rounded-2xl border px-3 py-2.5",
                  ROLE_BUBBLE[message.role],
                  isSelectionMode && selectedIDs.includes(message.id)
                    ? "ring-2 ring-blue-400/60"
                    : "",
                )}
              >
                {isSelectionMode ? (
                  <input
                    type="checkbox"
                    checked={selectedIDs.includes(message.id)}
                    readOnly
                    className="absolute right-2 top-2 h-4 w-4 accent-blue-500"
                  />
                ) : null}
                <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-white/45">
                  <span>{ROLE_LABEL[message.role]}</span>
                  {message.meta ? (
                    <span className="text-white/30">{message.meta}</span>
                  ) : null}
                </div>
                <MessageContent message={message} />
              </Card>
            </div>
          </div>
        ))}

        {isSending ? (
          <div className="text-sm text-white/55">Thinking...</div>
        ) : null}
        {showJump ? (
          <Button
            type="button"
            size="xs"
            variant="outline"
            onClick={jumpToLatest}
            className="sticky bottom-0 ml-auto rounded-full border-white/15 bg-black/60 px-2.5 text-[12px] text-white/80"
          >
            Jump to latest
          </Button>
        ) : null}
      </section>

      <section className="space-y-2 border-t border-white/10 p-2.5">
        <div className="flex flex-wrap gap-1.5">
          {QUICK_ACTIONS.map((a) => (
            <Button
              key={a.id}
              size="xs"
              variant="outline"
              onClick={() => send(a.prompt)}
              disabled={isSending || isSelectionMode}
              className="rounded-full border-white/10 bg-black/10 px-2 text-[12px] text-white/75"
            >
              {a.label}
            </Button>
          ))}
          <Button
            size="xs"
            variant="outline"
            onClick={insertSelectionToDraft}
            disabled={isSending || isSelectionMode}
            className="rounded-full border-white/10 bg-black/10 px-2 text-[12px] text-white/75"
          >
            Insert selection
          </Button>
        </div>

        {isSelectionMode ? (
          <Card className="border-white/10 bg-black/20 px-2.5 py-1.5">
            <CardContent className="flex items-center justify-between p-0">
              <div className="text-[13px] text-white/70">
                Selected {selectedIDs.length} message
                {selectedIDs.length === 1 ? "" : "s"}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  onClick={clearSelectionMode}
                  className="h-7 border-white/10 bg-transparent px-2 text-[12px] text-white/80"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  onClick={saveSelectionAsAnnotation}
                  disabled={!canSaveToAnnotation}
                  className="h-7 border-white/10 bg-transparent px-2 text-[12px] text-white/80"
                  title={
                    queuedSelection.trim()
                      ? "Create annotation with selected messages in comment"
                      : "Select text in reader first"
                  }
                >
                  {isSavingAnnotation ? "Saving..." : "Save to annotation"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <Card className="border-white/10 bg-black/10 p-2.5">
          <CardContent className="space-y-2 p-0">
            <Textarea
              data-can-scroll="true"
              rows={3}
              placeholder="Ask about the paper..."
              value={draft}
              onChange={(e) => updateDraft(e.target.value)}
              disabled={isSending || isSelectionMode}
              className="min-h-[76px] resize-none border-white/10 bg-transparent text-[14px] leading-6 text-[var(--fill-primary)] placeholder:text-white/35"
            />

            <Separator className="bg-white/5" />

            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1.5">
                <Badge
                  variant="outline"
                  className="border-white/10 px-1.5 py-0 text-[12px] text-white/65"
                >
                  {settings.provider}
                </Badge>
                <Badge
                  variant="outline"
                  className="border-white/10 px-1.5 py-0 text-[12px] text-white/65"
                >
                  {settings.model}
                </Badge>
                {queuedSelection ? (
                  <Badge
                    variant="outline"
                    className="border-white/10 px-1.5 py-0 text-[12px] text-white/65"
                  >
                    Selection Ready
                  </Badge>
                ) : null}
              </div>
              <Button
                onClick={() => send(draft)}
                disabled={!draft.trim() || isSending || isSelectionMode}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-[13px] font-semibold"
              >
                {isSending ? "Sending..." : "Send"}
              </Button>
            </div>

            {requestError ? (
              <div className="text-[13px] text-red-300">{requestError}</div>
            ) : null}
          </CardContent>
        </Card>
      </section>
    </aside>
  );
}
