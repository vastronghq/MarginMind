import { useEffect, useMemo, useRef, useState } from "react";
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

type ChatMessage = {
  id: string;
  role: "assistant" | "user" | "system";
  text: string;
  meta?: string;
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
  activeContext: ItemPaneData | null;
};

type InSituAIChatWindow = Window & {
  __insituaiItemPaneChatState?: PersistedState;
};

const PREVIEW_ID = "selection-preview";

function nowID(prefix: string) {
  return `${prefix}-${Date.now()}`;
}

function initialMessages(): ChatMessage[] {
  return [
    {
      id: "assistant-greeting",
      role: "assistant",
      text: "AI chat is ready. Ask for summary, critique, extraction, or rewrite.",
      meta: "Ready",
    },
  ];
}

function createSession(partial?: Partial<ChatSession>): ChatSession {
  const ts = Date.now();
  return {
    id: partial?.id ?? nowID("session"),
    title: partial?.title ?? "New chat",
    updatedAt: partial?.updatedAt ?? ts,
    messages: partial?.messages ?? initialMessages(),
    draft: partial?.draft ?? "",
    queuedSelection: partial?.queuedSelection ?? "",
  };
}

function getPersisted(): PersistedState | null {
  return (
    (globalThis as unknown as InSituAIChatWindow).__insituaiItemPaneChatState ??
    null
  );
}

function setPersisted(state: PersistedState) {
  (globalThis as unknown as InSituAIChatWindow).__insituaiItemPaneChatState =
    state;
}

function seedState(data: ItemPaneData | null): PersistedState {
  const saved = getPersisted();
  if (saved?.sessions?.length) {
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
  }
  const first = createSession();
  return {
    sessions: [first],
    activeSessionID: first.id,
    activeContext: data,
  };
}

function toTime(ts: number) {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function trimTitle(text: string, max = 42) {
  const s = text.replace(/\s+/g, " ").trim();
  if (!s) return "New chat";
  return s.length > max ? `${s.slice(0, max)}...` : s;
}

function bubbleClass(role: ChatMessage["role"]) {
  if (role === "system") {
    return "border-[var(--accent-blue)]/20 bg-[color-mix(in_srgb,var(--accent-blue)_10%,transparent)] text-[13px] text-white/75";
  }
  if (role === "assistant") {
    return "border-white/10 bg-white/5 text-[14px] text-[var(--fill-primary)]";
  }
  return "border-[var(--accent-blue)]/35 bg-[color-mix(in_srgb,var(--accent-blue)_22%,transparent)] text-[14px] text-[var(--fill-primary)]";
}

function MessageBubble({
  message,
  selectionMode,
  selected,
}: {
  message: ChatMessage;
  selectionMode: boolean;
  selected: boolean;
}) {
  const isAssistantSide = message.role !== "user";

  return (
    <div
      className={cn("flex", isAssistantSide ? "justify-start" : "justify-end")}
    >
      <Card
        className={cn(
          "relative max-w-[92%] rounded-2xl border px-3 py-2.5",
          bubbleClass(message.role),
          selectionMode && selected
            ? "ring-[var(--accent-blue)]/55 ring-2"
            : "",
        )}
      >
        {selectionMode ? (
          <input
            type="checkbox"
            checked={selected}
            readOnly
            className="absolute right-2 top-2 h-4 w-4 accent-[var(--accent-blue)]"
          />
        ) : null}

        <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-white/45">
          <span>
            {message.role === "assistant"
              ? "InSitu"
              : message.role === "system"
                ? "Selection"
                : "You"}
          </span>
          {message.meta ? (
            <span className="text-white/30">{message.meta}</span>
          ) : null}
        </div>

        <div
          data-render-mode="plain"
          className="whitespace-pre-wrap break-words text-[14px] leading-6"
        >
          {message.text}
        </div>
      </Card>
    </div>
  );
}

function EmptyPane() {
  return (
    <Card className="h-full rounded-xl border-white/10 bg-[var(--material-sidepane)] px-4 py-5 text-[var(--fill-primary)]">
      <CardTitle className="text-[16px]">No item selected</CardTitle>
      <CardDescription className="mt-1 text-[14px] text-white/55">
        Select an item to open the assistant workspace.
      </CardDescription>
    </Card>
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

  function patchSession(
    sessionID: string,
    mutate: (session: ChatSession) => ChatSession,
  ) {
    setSessions((current) =>
      current.map((session) =>
        session.id === sessionID
          ? { ...mutate(session), updatedAt: Date.now() }
          : session,
      ),
    );
  }

  function patchActive(mutate: (session: ChatSession) => ChatSession) {
    if (!activeSession) return;
    patchSession(activeSession.id, mutate);
  }

  function clearSelectionMode() {
    setIsSelectionMode(false);
    setSelectedIDs([]);
  }

  function showError(text: string, ms = 5000) {
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    setRequestError(text);
    errorTimerRef.current = setTimeout(() => setRequestError(""), ms);
  }

  function buildSystemPrompt(context: ItemPaneData | null) {
    const lines = [
      "Paper context:",
      context ? `Title: ${context.title}` : "Title: (none)",
      context ? `Creators: ${context.creators}` : "Creators: (none)",
      context ? `Year: ${context.year}` : "Year: (none)",
      context ? `Key: ${context.keyText}` : "Key: (none)",
      context ? `Abstract: ${context.abstractPreview}` : "Abstract: (none)",
    ];
    return `${settings.systemPrompt}\n\n${lines.join("\n")}`;
  }

  function normalizePrompt(input: string, baseMessages: ChatMessage[]) {
    const trimmed = input.trim();
    if (!trimmed) return null;

    const previewIndex = baseMessages.findIndex((m) => m.id === PREVIEW_ID);
    if (previewIndex === -1) {
      return {
        text: trimmed,
        messages: [
          ...baseMessages,
          { id: nowID("user"), role: "user" as const, text: trimmed },
        ],
      };
    }

    const preview = baseMessages[previewIndex];
    const merged = `${trimmed}\n\n[Selected text from paper]\n${preview.text}`;
    const next = [...baseMessages];
    next[previewIndex] = { id: nowID("user"), role: "user", text: merged };
    return { text: merged, messages: next };
  }

  async function send(prompt: string) {
    if (!activeSession || isSending) return;

    const sessionID = activeSession.id;
    const normalized = normalizePrompt(prompt, activeSession.messages);
    if (!normalized) return;

    const userAndHistory = normalized.messages;

    patchSession(sessionID, (session) => ({
      ...session,
      title:
        session.title === "New chat"
          ? trimTitle(normalized.text)
          : session.title,
      messages: userAndHistory,
      draft: "",
      queuedSelection: "",
    }));

    setIsSending(true);
    setRequestError("");

    const assistantID = nowID("assistant");
    patchSession(sessionID, (session) => ({
      ...session,
      messages: [
        ...session.messages,
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
        { role: "system", content: buildSystemPrompt(activeContext) },
        ...userAndHistory
          .filter(
            (m): m is ChatMessage & { role: "user" | "assistant" } =>
              m.role === "user" || m.role === "assistant",
          )
          .map((m) => ({ role: m.role, content: m.text })),
      ];

      let full = "";
      for await (const delta of streamAIReply({
        settings,
        messages: apiMessages,
      })) {
        full += delta;
        patchSession(sessionID, (session) => ({
          ...session,
          messages: session.messages.map((m) =>
            m.id === assistantID ? { ...m, text: full } : m,
          ),
        }));
      }

      if (!full.trim()) {
        patchSession(sessionID, (session) => ({
          ...session,
          messages: session.messages.map((m) =>
            m.id === assistantID ? { ...m, text: "(empty response)" } : m,
          ),
        }));
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Request failed.";
      showError(msg);
      patchSession(sessionID, (session) => ({
        ...session,
        messages: [
          ...session.messages,
          {
            id: nowID("assistant-error"),
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

  function updateDraft(next: string) {
    patchActive((session) => ({ ...session, draft: next }));
  }

  function insertSelectionToDraft() {
    if (!queuedSelection) return;
    const nextDraft = draft.trim()
      ? `${draft.trim()}\n\n[Selected text]\n${queuedSelection}`
      : `[Selected text]\n${queuedSelection}`;
    updateDraft(nextDraft);
  }

  function createNewSession() {
    const next = createSession();
    setSessions((current) => [next, ...current]);
    setActiveSessionID(next.id);
    setRequestError("");
    selectionSigRef.current = "";
    clearSelectionMode();
  }

  function jumpToLatest() {
    const el = messageRef.current;
    if (!el) return;
    autoScrollRef.current = true;
    setShowJump(false);
    el.scrollTop = el.scrollHeight;
  }

  function toggleMessage(id: string) {
    setSelectedIDs((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );
  }

  function startLongPress(id: string) {
    if (isSelectionMode) return;
    longPressTriggeredRef.current = false;
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true;
      setIsSelectionMode(true);
      setSelectedIDs([id]);
    }, 420);
  }

  function endLongPress() {
    if (!longPressTimerRef.current) return;
    clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = null;
  }

  async function saveSelectionAsAnnotation() {
    if (
      !canSaveToAnnotation ||
      !selectedAnnotation ||
      !activeContext?.attachmentItemID
    ) {
      return;
    }

    setIsSavingAnnotation(true);
    setRequestError("");

    try {
      const attachment = Zotero.Items.get(activeContext.attachmentItemID) as
        | Zotero.Item
        | undefined;
      if (!attachment || !attachment.isAttachment()) {
        throw new Error("Attachment not found for annotation.");
      }

      const comment = messages
        .filter((m) => selectedIDs.includes(m.id))
        .map((m) => `----- ${m.role.toUpperCase()} -----\n${m.text}`)
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
      const msg =
        error instanceof Error ? error.message : "Failed to save annotation.";
      showError(msg, 2000);
    } finally {
      setIsSavingAnnotation(false);
    }
  }

  useEffect(() => {
    if (sessions.length === 0) {
      const fallback = createSession();
      setSessions([fallback]);
      setActiveSessionID(fallback.id);
      return;
    }

    if (!sessions.some((s) => s.id === activeSessionID)) {
      setActiveSessionID(sessions[0].id);
    }
  }, [sessions, activeSessionID]);

  useEffect(() => {
    if (data) setActiveContext(data);
  }, [data]);

  useEffect(() => {
    setPersisted({ sessions, activeSessionID, activeContext });
  }, [sessions, activeSessionID, activeContext]);

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const aside = asideRef.current;
    if (!aside) return;

    const onWheel = (e: WheelEvent) => {
      const target = (e.target as Element)?.closest(
        '[data-can-scroll="true"]',
      ) as HTMLElement | null;
      if (!target) {
        e.preventDefault();
        return;
      }
      const atTop = e.deltaY < 0 && target.scrollTop <= 0;
      const atBottom =
        e.deltaY > 0 &&
        target.scrollTop + target.clientHeight >= target.scrollHeight;
      if (atTop || atBottom) e.preventDefault();
      e.stopPropagation();
    };

    aside.addEventListener("wheel", onWheel, { passive: false });
    return () => aside.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    const list = messageRef.current;
    if (!list || !autoScrollRef.current) return;
    list.scrollTop = list.scrollHeight;
  }, [messages, isSending]);

  useEffect(() => {
    const list = messageRef.current;
    if (!list) return;

    const onScroll = () => {
      const distance = list.scrollHeight - list.scrollTop - list.clientHeight;
      const nearBottom = distance <= 48;
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
      patchActive((session) => {
        const hasPreview = session.messages.some((m) => m.id === PREVIEW_ID);
        if (!hasPreview && !session.queuedSelection) return session;
        return {
          ...session,
          queuedSelection: "",
          messages: session.messages.filter((m) => m.id !== PREVIEW_ID),
        };
      });
      return;
    }

    if (selectionSigRef.current === selectedText) return;
    selectionSigRef.current = selectedText;

    patchActive((session) => {
      const index = session.messages.findIndex((m) => m.id === PREVIEW_ID);
      const preview: ChatMessage = {
        id: PREVIEW_ID,
        role: "user",
        text: selectedText,
        meta: "Selection preview",
      };

      if (index === -1) {
        return {
          ...session,
          queuedSelection: selectedText,
          messages: [...session.messages, preview],
        };
      }

      const next = [...session.messages];
      next[index] = preview;
      return { ...session, queuedSelection: selectedText, messages: next };
    });
  }, [selectedText, showSelectedText, activeSessionID]);

  if (!activeContext && messages.length === 0) {
    return <EmptyPane />;
  }

  const quickActions = [
    {
      id: "sum",
      label: "Summarize",
      run: () => send("Summarize the main points of this paper."),
    },
    {
      id: "crit",
      label: "Critique",
      run: () => send("Critique the methodology and assumptions."),
    },
    {
      id: "notes",
      label: "To notes",
      run: () => send("Turn the selection into concise notes with bullets."),
    },
    { id: "ins", label: "Insert selection", run: insertSelectionToDraft },
  ];

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
          <Card className="border-white/10 bg-black/15 p-1.5">
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
                          ? "border-[var(--accent-blue)]/45 bg-[color-mix(in_srgb,var(--accent-blue)_14%,transparent)]"
                          : "border-white/10 bg-black/20 hover:bg-white/5",
                      )}
                    >
                      <div className="truncate pr-1 text-[13px] font-medium text-[var(--fill-primary)]">
                        {session.title}
                      </div>
                      <div className="mt-3 flex justify-between text-[12px] text-white/50">
                        <div>{toTime(session.updatedAt)}</div>
                        <div>{session.messages.length} messages</div>
                      </div>
                    </button>
                  );
                })}
            </CardContent>
          </Card>
        ) : null}

        <Card className="border-white/10 bg-black/10 text-white/70">
          <CardHeader className="pb-1.5">
            <CardTitle className="text-[12px] font-bold uppercase tracking-[0.08em] text-white/40">
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
            onPointerUp={endLongPress}
            onPointerLeave={endLongPress}
            onPointerCancel={endLongPress}
            onClick={() => {
              if (!isSelectionMode) return;
              if (longPressTriggeredRef.current) {
                longPressTriggeredRef.current = false;
                return;
              }
              toggleMessage(message.id);
            }}
          >
            <MessageBubble
              message={message}
              selectionMode={isSelectionMode}
              selected={selectedIDs.includes(message.id)}
            />
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
          {quickActions.map((action) => (
            <Button
              key={action.id}
              size="xs"
              variant="outline"
              onClick={action.run}
              disabled={isSending || isSelectionMode}
              className="rounded-full border-white/10 bg-black/10 px-2 text-[12px] text-white/75"
            >
              {action.label}
            </Button>
          ))}
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
