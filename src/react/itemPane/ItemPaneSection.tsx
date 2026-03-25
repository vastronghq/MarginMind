import { useEffect, useMemo, useRef, useState } from "react";
import { streamAIReply, type AIChatMessage } from "../../modules/aiService";
import { loadAISettings } from "../../utils/aiPrefs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

type ItemPaneSectionProps = {
  data: {
    itemID: number | null;
    attachmentItemID: number | null;
    title: string;
    creators: string;
    year: string;
    abstractPreview: string;
    keyText: string;
  } | null;
  showSelectedText?: boolean;
  selectedText: string;
  selectedAnnotation: _ZoteroTypes.Annotations.AnnotationJson | null;
};

type ItemContext = NonNullable<ItemPaneSectionProps["data"]>;

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

type PersistedChatState = {
  sessions: ChatSession[];
  activeSessionID: string;
  activeContext: ItemContext | null;
};

type InSituAIChatWindow = Window & {
  __insituaiItemPaneChatState?: PersistedChatState;
};

function getPersistedState(): PersistedChatState | null {
  const win = globalThis as unknown as InSituAIChatWindow;
  return win.__insituaiItemPaneChatState ?? null;
}

function setPersistedState(state: PersistedChatState) {
  const win = globalThis as unknown as InSituAIChatWindow;
  win.__insituaiItemPaneChatState = state;
}

function createInitialMessages(): ChatMessage[] {
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
  const now = Date.now();
  return {
    id: partial?.id ?? `session-${now}`,
    title: partial?.title ?? "New chat",
    updatedAt: partial?.updatedAt ?? now,
    messages: partial?.messages ?? createInitialMessages(),
    draft: partial?.draft ?? "",
    queuedSelection: partial?.queuedSelection ?? "",
  };
}

function seedState(
  persisted: PersistedChatState | null,
  data: ItemContext | null,
): PersistedChatState {
  if (persisted?.sessions?.length) {
    const activeSessionExists = persisted.sessions.some(
      (session) => session.id === persisted.activeSessionID,
    );
    return {
      sessions: persisted.sessions,
      activeSessionID: activeSessionExists
        ? persisted.activeSessionID
        : persisted.sessions[0].id,
      activeContext: persisted.activeContext ?? data,
    };
  }

  const initialSession = createSession();
  return {
    sessions: [initialSession],
    activeSessionID: initialSession.id,
    activeContext: data,
  };
}

function trimTitle(text: string, max = 42) {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return "New chat";
  return cleaned.length > max ? `${cleaned.slice(0, max)}...` : cleaned;
}

function formatUpdatedAt(timestamp: number) {
  const date = new Date(timestamp);
  return `${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes(),
  ).padStart(2, "0")}`;
}

function MessageContent({ text }: { text: string }) {
  // Markdown render hook point: swap this block with a markdown renderer later.
  return (
    <div
      data-render-mode="plain"
      className="whitespace-pre-wrap break-words text-[14px] leading-6"
    >
      {text}
    </div>
  );
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
  const isAssistant = message.role === "assistant";
  const isSystem = message.role === "system";

  return (
    <div
      className={cn(
        "flex",
        isAssistant || isSystem ? "justify-start" : "justify-end",
      )}
    >
      <Card
        className={cn(
          "relative min-w-0 max-w-[92%] rounded-2xl border px-3 py-2.5",
          isSystem
            ? "border-[var(--accent-blue)]/20 bg-[color-mix(in_srgb,var(--accent-blue)_10%,transparent)] text-[13px] text-white/75"
            : isAssistant
              ? "border-white/10 bg-white/5 text-[14px] text-[var(--fill-primary)]"
              : "border-[var(--accent-blue)]/35 bg-[color-mix(in_srgb,var(--accent-blue)_22%,transparent)] text-[14px] text-[var(--fill-primary)]",
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
          <span>{isAssistant ? "InSitu" : isSystem ? "Selection" : "You"}</span>
          {message.meta ? (
            <span className="text-white/30">{message.meta}</span>
          ) : null}
        </div>

        <MessageContent text={message.text} />
      </Card>
    </div>
  );
}

function EmptyPane() {
  return (
    <Card className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden rounded-xl border-white/10 bg-[var(--material-sidepane)] px-4 py-5 text-[var(--fill-primary)]">
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
  const seeded = seedState(getPersistedState(), data);
  const [sessions, setSessions] = useState<ChatSession[]>(seeded.sessions);
  const [activeSessionID, setActiveSessionID] = useState(
    seeded.activeSessionID,
  );
  const [activeContext, setActiveContext] = useState<ItemContext | null>(
    seeded.activeContext ?? data ?? null,
  );
  const [isSending, setIsSending] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState<string[]>([]);
  const [isSavingAnnotation, setIsSavingAnnotation] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const selectionSignatureRef = useRef("");
  const asideRef = useRef<HTMLElement | null>(null);
  const messageRef = useRef<HTMLDivElement | null>(null);
  const autoScrollRef = useRef(true);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const errorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentSettings = loadAISettings();

  const activeSession = useMemo(
    () =>
      sessions.find((session) => session.id === activeSessionID) ?? sessions[0],
    [sessions, activeSessionID],
  );

  const messages = activeSession?.messages ?? [];
  const draft = activeSession?.draft ?? "";
  const queuedSelection = activeSession?.queuedSelection ?? "";

  function updateSessionByID(
    sessionID: string,
    updater: (session: ChatSession) => ChatSession,
  ) {
    setSessions((current) =>
      current.map((session) =>
        session.id === sessionID
          ? { ...updater(session), updatedAt: Date.now() }
          : session,
      ),
    );
  }

  function updateActiveSession(updater: (session: ChatSession) => ChatSession) {
    if (!activeSession) return;
    updateSessionByID(activeSession.id, updater);
  }

  useEffect(() => {
    if (sessions.length === 0) {
      const fallback = createSession();
      setSessions([fallback]);
      setActiveSessionID(fallback.id);
      return;
    }

    if (!sessions.some((session) => session.id === activeSessionID)) {
      setActiveSessionID(sessions[0].id);
    }
  }, [sessions, activeSessionID]);

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const aside = asideRef.current;
    if (!aside) return;

    const handleWheel = (e: WheelEvent) => {
      const isScrollableElement = (e.target as Element)?.closest(
        '[data-can-scroll="true"]',
      );
      if (isScrollableElement) {
        const { scrollTop, scrollHeight, clientHeight } = isScrollableElement;
        const isAtTop = e.deltaY < 0 && scrollTop <= 0;
        const isAtBottom =
          e.deltaY > 0 && scrollTop + clientHeight >= scrollHeight;
        if (isAtTop || isAtBottom) {
          e.preventDefault();
        }
        e.stopPropagation();
      } else {
        e.preventDefault();
      }
    };

    aside.addEventListener("wheel", handleWheel, { passive: false });
    return () => aside.removeEventListener("wheel", handleWheel);
  }, []);

  useEffect(() => {
    const messageContainer = messageRef.current;
    if (!messageContainer || !autoScrollRef.current) return;
    messageContainer.scrollTop = messageContainer.scrollHeight;
  }, [messages, isSending]);

  useEffect(() => {
    const messageContainer = messageRef.current;
    if (!messageContainer) return;

    const nearBottomThreshold = 48;
    const onScroll = () => {
      const distanceToBottom =
        messageContainer.scrollHeight -
        messageContainer.scrollTop -
        messageContainer.clientHeight;
      const isNearBottom = distanceToBottom <= nearBottomThreshold;
      autoScrollRef.current = isNearBottom;
      setShowJumpToLatest(!isNearBottom);
    };

    onScroll();
    messageContainer.addEventListener("scroll", onScroll, { passive: true });
    return () => messageContainer.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!data) return;
    setActiveContext(data);
  }, [data]);

  useEffect(() => {
    setPersistedState({
      sessions,
      activeSessionID,
      activeContext,
    });
  }, [sessions, activeSessionID, activeContext]);

  useEffect(() => {
    if (!activeSession) return;

    if (!showSelectedText || !selectedText) {
      updateActiveSession((session) => {
        const hasPreview = session.messages.some(
          (message) => message.id === "selection-preview",
        );
        if (!hasPreview && !session.queuedSelection) {
          return session;
        }
        return {
          ...session,
          messages: session.messages.filter(
            (message) => message.id !== "selection-preview",
          ),
          queuedSelection: "",
        };
      });
      return;
    }

    if (selectionSignatureRef.current === selectedText) return;

    selectionSignatureRef.current = selectedText;
    updateActiveSession((session) => {
      const previewIndex = session.messages.findIndex(
        (message) => message.id === "selection-preview",
      );
      const previewMessage: ChatMessage = {
        id: "selection-preview",
        role: "user",
        text: selectedText,
        meta: "Selection preview",
      };

      if (previewIndex !== -1) {
        const nextMessages = [...session.messages];
        nextMessages[previewIndex] = previewMessage;
        return {
          ...session,
          queuedSelection: selectedText,
          messages: nextMessages,
        };
      }

      return {
        ...session,
        queuedSelection: selectedText,
        messages: [...session.messages, previewMessage],
      };
    });
  }, [selectedText, showSelectedText, activeSessionID]);

  if (!activeContext && messages.length === 0) {
    return <EmptyPane />;
  }

  const itemData = activeContext;

  const canSaveToAnnotation =
    !!queuedSelection.trim() &&
    !!selectedAnnotation &&
    !!itemData?.attachmentItemID &&
    selectedMessageIds.length > 0 &&
    !isSavingAnnotation;

  const quickActions = [
    {
      id: "summarize",
      label: "Summarize the paper",
      onClick: () => send("Summarize the main points of this paper."),
    },
    {
      id: "critique",
      label: "Critique the paper",
      onClick: () => send("Critique the methodology and assumptions."),
    },
    {
      id: "to-notes",
      label: "Turn selection into notes",
      onClick: () =>
        send("Turn the selection into concise notes with bullets."),
    },
    {
      id: "insert",
      label: "Insert selection",
      onClick: useSelection,
    },
  ];

  function buildSystemPrompt() {
    const contextPrompt = [
      "Paper context:",
      itemData ? `Title: ${itemData.title}` : "Title: (none)",
      itemData ? `Creators: ${itemData.creators}` : "Creators: (none)",
      itemData ? `Year: ${itemData.year}` : "Year: (none)",
      itemData ? `Key: ${itemData.keyText}` : "Key: (none)",
      itemData ? `Abstract: ${itemData.abstractPreview}` : "Abstract: (none)",
    ]
      .filter(Boolean)
      .join("\n");
    return `${currentSettings.systemPrompt}\n\n${contextPrompt}`;
  }

  async function send(prompt: string) {
    if (!activeSession || isSending) return;

    const trimmed = prompt.trim();
    if (!trimmed) return;

    const sessionID = activeSession.id;
    const previewIndex = activeSession.messages.findIndex(
      (message) => message.id === "selection-preview",
    );

    let updatedMessages: ChatMessage[];
    let finalPrompt = trimmed;

    if (previewIndex !== -1) {
      const previewMessage = activeSession.messages[previewIndex];
      finalPrompt = `${trimmed}\n\n[Selected text from paper]\n${previewMessage.text}`;
      updatedMessages = [...activeSession.messages];
      updatedMessages[previewIndex] = {
        id: `user-${Date.now()}`,
        role: "user",
        text: finalPrompt,
      };
    } else {
      updatedMessages = [
        ...activeSession.messages,
        {
          id: `user-${Date.now()}`,
          role: "user",
          text: finalPrompt,
        },
      ];
    }

    updateSessionByID(sessionID, (session) => ({
      ...session,
      title:
        session.title === "New chat" ? trimTitle(finalPrompt) : session.title,
      messages: updatedMessages,
      draft: "",
      queuedSelection: "",
    }));

    setRequestError("");
    setIsSending(true);

    try {
      const apiMessages: AIChatMessage[] = [
        {
          role: "system",
          content: buildSystemPrompt(),
        },
        ...updatedMessages
          .filter(
            (
              message,
            ): message is ChatMessage & { role: "user" | "assistant" } =>
              message.role === "user" || message.role === "assistant",
          )
          .map((message) => ({
            role: message.role,
            content: message.text,
          })),
      ];

      const assistantMessageID = `assistant-${Date.now()}`;
      updateSessionByID(sessionID, (session) => ({
        ...session,
        messages: [
          ...session.messages,
          {
            id: assistantMessageID,
            role: "assistant",
            text: "",
            meta: `${currentSettings.provider} / ${currentSettings.model}`,
          },
        ],
      }));

      let fullText = "";
      for await (const delta of streamAIReply({
        settings: currentSettings,
        messages: apiMessages,
      })) {
        fullText += delta;
        updateSessionByID(sessionID, (session) => ({
          ...session,
          messages: session.messages.map((message) =>
            message.id === assistantMessageID
              ? { ...message, text: fullText }
              : message,
          ),
        }));
      }

      if (!fullText.trim()) {
        updateSessionByID(sessionID, (session) => ({
          ...session,
          messages: session.messages.map((message) =>
            message.id === assistantMessageID
              ? { ...message, text: "(empty response)" }
              : message,
          ),
        }));
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Request failed.";
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
      }
      setRequestError(errorMessage);
      errorTimeoutRef.current = setTimeout(() => {
        setRequestError("");
      }, 5000);

      updateSessionByID(sessionID, (session) => ({
        ...session,
        messages: [
          ...session.messages,
          {
            id: `assistant-error-${Date.now()}`,
            role: "assistant",
            text: `Request failed: ${errorMessage}`,
            meta: "Error",
          },
        ],
      }));
    } finally {
      setIsSending(false);
    }
  }

  function updateDraft(nextDraft: string) {
    updateActiveSession((session) => ({
      ...session,
      draft: nextDraft,
    }));
  }

  function useSelection() {
    if (!queuedSelection) return;
    const nextDraft = draft.trim()
      ? `${draft.trim()}\n\n[Selected text]\n${queuedSelection}`
      : `[Selected text]\n${queuedSelection}`;
    updateDraft(nextDraft);
  }

  function jumpToLatest() {
    const messageContainer = messageRef.current;
    if (!messageContainer) return;
    autoScrollRef.current = true;
    setShowJumpToLatest(false);
    messageContainer.scrollTop = messageContainer.scrollHeight;
  }

  function createNewSession() {
    const nextSession = createSession();
    setSessions((current) => [nextSession, ...current]);
    setActiveSessionID(nextSession.id);
    setIsSelectionMode(false);
    setSelectedMessageIds([]);
    setRequestError("");
    selectionSignatureRef.current = "";
  }

  function toggleMessageSelection(messageID: string) {
    setSelectedMessageIds((current) =>
      current.includes(messageID)
        ? current.filter((id) => id !== messageID)
        : [...current, messageID],
    );
  }

  function handleMessagePointerDown(messageID: string) {
    if (isSelectionMode) return;
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }
    longPressTimerRef.current = setTimeout(() => {
      setIsSelectionMode(true);
      setSelectedMessageIds([messageID]);
    }, 450);
  }

  function cancelLongPress() {
    if (!longPressTimerRef.current) return;
    clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = null;
  }

  function clearSelectionMode() {
    setIsSelectionMode(false);
    setSelectedMessageIds([]);
  }

  async function saveSelectedMessagesAsAnnotation() {
    if (
      !canSaveToAnnotation ||
      !selectedAnnotation ||
      !itemData?.attachmentItemID
    ) {
      return;
    }

    setRequestError("");
    setIsSavingAnnotation(true);
    try {
      const attachment = Zotero.Items.get(itemData.attachmentItemID) as
        | Zotero.Item
        | undefined;
      if (!attachment || !attachment.isAttachment()) {
        throw new Error("Attachment not found for annotation.");
      }

      const messageComment = messages
        .filter((message) => selectedMessageIds.includes(message.id))
        .map((message) => {
          const roleLabel =
            message.role === "assistant"
              ? "Assistant"
              : message.role === "user"
                ? "User"
                : "System";
          return `----- ${roleLabel} -----\n${message.text}`;
        })
        .join("\n\n");

      const annotation = new Zotero.Item("annotation") as any;
      annotation.libraryID = attachment.libraryID;
      annotation.parentKey = attachment.key;
      annotation.annotationType = selectedAnnotation.type || "highlight";
      annotation.annotationPageLabel =
        selectedAnnotation.position.pageIndex + 1;
      annotation.annotationText = selectedAnnotation.text || "";
      annotation.annotationComment = messageComment;
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
      const errorMessage =
        error instanceof Error ? error.message : "Failed to save annotation.";
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
      }
      setRequestError(errorMessage);
      errorTimeoutRef.current = setTimeout(() => {
        setRequestError("");
      }, 1500);
    } finally {
      setIsSavingAnnotation(false);
    }
  }

  return (
    <aside
      ref={asideRef}
      className="border-width-[0.5px] flex max-h-[80vh] min-h-0 w-full flex-col overflow-hidden border-solid border-[var(--accent-blue)] bg-[var(--material-sidepane)] text-[var(--fill-primary)]"
    >
      <section className="flex shrink-0 grow-0 flex-col gap-2 p-2.5">
        <div className="flex items-center justify-between gap-1.5">
          <Button
            size="xs"
            variant="outline"
            onClick={() => setIsHistoryOpen((current) => !current)}
            className="h-7 border-white/15 bg-black/20 px-2 text-[12px] text-[var(--fill-primary)] hover:bg-white/10"
          >
            {isHistoryOpen ? "Hide history" : "Show history"}
          </Button>
          <Button
            size="xs"
            variant="outline"
            onClick={createNewSession}
            disabled={isSending}
            className="h-7 border-white/15 bg-black/20 px-2 text-[12px] text-[var(--fill-primary)] hover:bg-white/10"
          >
            New chat
          </Button>
        </div>

        {isHistoryOpen ? (
          <Card className="border-white/10 bg-black/15 p-1.5">
            <CardContent
              data-can-scroll="true"
              className="flex max-h-[240px] flex-col gap-1.5 overflow-y-auto p-0 pr-1"
            >
              {sessions
                .slice()
                .sort((a, b) => b.updatedAt - a.updatedAt)
                .map((session) => {
                  const isActive = session.id === activeSessionID;
                  return (
                    <button
                      key={session.id}
                      type="button"
                      disabled={isSending}
                      onClick={() => {
                        setActiveSessionID(session.id);
                        setIsSelectionMode(false);
                        setSelectedMessageIds([]);
                        setRequestError("");
                        setIsHistoryOpen(false);
                      }}
                      className={cn(
                        "rounded-lg border p-2 text-left transition",
                        isActive
                          ? "border-[var(--accent-blue)]/45 bg-[color-mix(in_srgb,var(--accent-blue)_14%,transparent)]"
                          : "border-white/10 bg-black/20 hover:bg-white/5",
                      )}
                    >
                      <div className="flex h-7 items-center gap-2">
                        <div className="min-w-0 flex-1 truncate pr-1 text-[13px] font-medium leading-4 text-[var(--fill-primary)]">
                          {session.title}
                        </div>
                        <div className="shrink-0 whitespace-nowrap text-[12px] font-medium leading-4 text-white/80">
                          {session.messages.length} messages |{" "}
                          {formatUpdatedAt(session.updatedAt)}
                        </div>
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
            {itemData
              ? `${itemData.title} / ${itemData.creators} / ${itemData.year} / ${itemData.keyText}`
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
            onPointerDown={() => handleMessagePointerDown(message.id)}
            onPointerUp={cancelLongPress}
            onPointerLeave={cancelLongPress}
            onPointerCancel={cancelLongPress}
            onClick={() => {
              if (isSelectionMode) {
                toggleMessageSelection(message.id);
              }
            }}
          >
            <MessageBubble
              message={message}
              selectionMode={isSelectionMode}
              selected={selectedMessageIds.includes(message.id)}
            />
          </div>
        ))}

        {isSending ? (
          <div className="text-sm text-white/55">Thinking...</div>
        ) : null}

        {showJumpToLatest ? (
          <Button
            type="button"
            size="xs"
            variant="outline"
            onClick={jumpToLatest}
            className="sticky bottom-0 ml-auto rounded-full border-white/15 bg-black/60 px-2.5 text-[12px] text-white/80 backdrop-blur-sm hover:bg-black/75"
          >
            Jump to latest
          </Button>
        ) : null}
      </section>

      <section className="flex shrink-0 grow-0 flex-col gap-2 border-t border-white/10 p-2.5">
        {quickActions.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {quickActions.map((action) => (
              <Button
                key={action.id}
                size="xs"
                variant="outline"
                onClick={action.onClick}
                disabled={isSending || isSelectionMode}
                className="rounded-full border-white/10 bg-black/10 px-2 text-[12px] text-white/75 hover:bg-white/10"
              >
                {action.label}
              </Button>
            ))}
          </div>
        ) : null}

        {isSelectionMode ? (
          <Card className="border-white/10 bg-black/20 px-2.5 py-1.5">
            <CardContent className="flex items-center justify-between p-0">
              <div className="text-[13px] text-white/70">
                Selected {selectedMessageIds.length} message
                {selectedMessageIds.length === 1 ? "" : "s"}
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
                  onClick={saveSelectedMessagesAsAnnotation}
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
              onChange={(event) => updateDraft(event.target.value)}
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
                  {currentSettings.provider}
                </Badge>
                <Badge
                  variant="outline"
                  className="border-white/10 px-1.5 py-0 text-[12px] text-white/65"
                >
                  {currentSettings.model}
                </Badge>
                {queuedSelection ? (
                  <Badge
                    variant="outline"
                    className="border-white/10 px-1.5 py-0 text-[12px] text-white/65"
                  >
                    Selection Ready
                  </Badge>
                ) : null}
                <Badge
                  variant="outline"
                  className="border-white/10 px-1.5 py-0 text-[12px] text-white/50"
                >
                  Markdown-ready
                </Badge>
              </div>

              <Button
                disabled={!draft.trim() || isSending || isSelectionMode}
                onClick={() => send(draft)}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-[13px] font-semibold shadow-lg hover:brightness-110"
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
