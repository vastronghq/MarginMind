import { useEffect, useRef, useState } from "react";
import { streamAIReply, type AIChatMessage } from "../../modules/aiService";
import { loadAISettings } from "../../utils/aiPrefs";

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

type PersistedChatState = {
  messages: ChatMessage[];
  draft: string;
  queuedSelection: string;
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

function makeSelectionPrompt(selection: string) {
  return `Use this selection as evidence and explain its role in the paper:\n\n${selection}`;
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
      className={`flex ${isAssistant || isSystem ? "justify-start" : "justify-end"}`}
    >
      <div
        className={`relative min-w-0 max-w-[92%] rounded-2xl border px-3.5 py-3 ${
          isSystem
            ? "border-[var(--accent-blue)]/20 bg-[color-mix(in_srgb,var(--accent-blue)_10%,transparent)] text-[12px] text-white/75"
            : isAssistant
              ? "border-white/10 bg-white/5 text-[13px] text-[var(--fill-primary)]"
              : "border-[var(--accent-blue)]/35 bg-[color-mix(in_srgb,var(--accent-blue)_22%,transparent)] text-[13px] text-[var(--fill-primary)]"
        } ${selectionMode && selected ? "ring-[var(--accent-blue)]/55 ring-2" : ""}`}
      >
        {selectionMode ? (
          <input
            type="checkbox"
            checked={selected}
            readOnly
            className="absolute right-2 top-2 h-4 w-4 accent-[var(--accent-blue)]"
          />
        ) : null}
        <div className="mb-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/45">
          <span>{isAssistant ? "InSitu" : isSystem ? "Selection" : "You"}</span>
          {message.meta ? (
            <span className="text-white/30">{message.meta}</span>
          ) : null}
        </div>
        <div className="whitespace-pre-wrap break-words leading-6">
          {message.text}
        </div>
      </div>
    </div>
  );
}

function EmptyPane() {
  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden rounded-xl border border-white/10 bg-[var(--material-sidepane)] px-4 py-5 text-[var(--fill-primary)]">
      <div className="text-[15px] font-semibold">No item selected</div>
      <div className="mt-1 text-[13px] text-white/55">
        Select an item to open the assistant workspace.
      </div>
    </div>
  );
}

export function ItemPaneSection({
  data,
  showSelectedText = false,
  selectedText,
  selectedAnnotation,
}: ItemPaneSectionProps) {
  const persistedState = getPersistedState();
  const [messages, setMessages] = useState<ChatMessage[]>(
    persistedState?.messages?.length
      ? persistedState.messages
      : createInitialMessages(),
  );
  const [draft, setDraft] = useState(persistedState?.draft ?? "");
  const [queuedSelection, setQueuedSelection] = useState(
    persistedState?.queuedSelection ?? "",
  );
  const [activeContext, setActiveContext] = useState<ItemContext | null>(
    persistedState?.activeContext ?? data ?? null,
  );
  const [isSending, setIsSending] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState<string[]>([]);
  const [isSavingAnnotation, setIsSavingAnnotation] = useState(false);
  const selectionSignatureRef = useRef("");
  const asideRef = useRef<HTMLElement | null>(null);
  const messageRef = useRef<HTMLDivElement | null>(null);
  const autoScrollRef = useRef(true);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const errorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentSettings = loadAISettings();

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
      messages,
      draft,
      queuedSelection,
      activeContext,
    });
  }, [messages, draft, queuedSelection, activeContext]);

  useEffect(() => {
    if (!showSelectedText || !selectedText) return;
    if (selectionSignatureRef.current === selectedText) return;

    selectionSignatureRef.current = selectedText;
    setQueuedSelection(selectedText);
    setMessages((current) => {
      const next = current.filter(
        (message) => message.id !== "selection-context",
      );
      next.push({
        id: "selection-context",
        role: "system",
        text: selectedText,
        meta: "Reader selection synced",
      });
      return next;
    });
  }, [selectedText, showSelectedText]);

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
      queuedSelection ? `Reader selection: ${queuedSelection}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    return `${currentSettings.systemPrompt}\n\n${contextPrompt}`;
  }

  async function send(prompt: string) {
    if (isSending) return;
    const trimmed = prompt.trim();
    if (!trimmed) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text: trimmed,
    };
    const history = [...messages, userMessage];

    setMessages(history);
    setDraft("");
    setRequestError("");
    setIsSending(true);

    try {
      const apiMessages: AIChatMessage[] = [
        {
          role: "system",
          content: buildSystemPrompt(),
        },
        ...history
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

      const assistantMessageId = `assistant-${Date.now()}`;
      setMessages((current) => [
        ...current,
        {
          id: assistantMessageId,
          role: "assistant",
          text: "",
          meta: `${currentSettings.provider} / ${currentSettings.model}`,
        },
      ]);

      let fullText = "";
      for await (const delta of streamAIReply({
        settings: currentSettings,
        messages: apiMessages,
      })) {
        fullText += delta;
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantMessageId
              ? { ...message, text: fullText }
              : message,
          ),
        );
      }

      if (!fullText.trim()) {
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantMessageId
              ? { ...message, text: "(empty response)" }
              : message,
          ),
        );
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
      setMessages((current) => [
        ...current,
        {
          id: `assistant-error-${Date.now()}`,
          role: "assistant",
          text: `Request failed: ${errorMessage}`,
          meta: "Error",
        },
      ]);
    } finally {
      setIsSending(false);
    }
  }

  function useSelection() {
    if (!queuedSelection) return;
    const nextDraft = draft.trim()
      ? `${draft.trim()}\n\n${makeSelectionPrompt(queuedSelection)}`
      : makeSelectionPrompt(queuedSelection);
    setDraft(nextDraft);
  }

  function jumpToLatest() {
    const messageContainer = messageRef.current;
    if (!messageContainer) return;
    autoScrollRef.current = true;
    setShowJumpToLatest(false);
    messageContainer.scrollTop = messageContainer.scrollHeight;
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
          return `[${roleLabel}] ${message.text}`;
        })
        .join("\n\n");

      const annotationJSON = {
        ...selectedAnnotation,
        comment: messageComment,
        readOnly: false,
        isExternal: false,
        dateModified: new Date().toISOString(),
      } as _ZoteroTypes.Annotations.AnnotationJson;

      // Only generate new key if not present (should be present from selectedAnnotation)
      if (!annotationJSON.id) {
        const keyGenerator = (Zotero as any).DataObjectUtilities?.generateKey;
        if (typeof keyGenerator === "function") {
          const key = keyGenerator();
          annotationJSON.key = key;
          annotationJSON.id = key;
        }
      }

      await Zotero.Annotations.saveFromJSON(attachment, annotationJSON);
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
      <section className="flex shrink-0 grow-0 flex-col justify-center gap-3 p-3">
        <div className="rounded-lg border border-white/10 bg-black/10 p-3 text-[12px] leading-relaxed text-white/60">
          <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-white/30">
            Context
          </div>
          <div className="text-md">
            {itemData
              ? `${itemData.title} / ${itemData.creators} / ${itemData.year} / ${itemData.keyText}`
              : "No active item context"}
          </div>
        </div>
      </section>

      <section
        data-can-scroll="true"
        ref={messageRef}
        className="relative flex max-h-[40vh] min-h-0 flex-1 flex-col gap-3 overflow-hidden overflow-y-auto p-3"
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
          <div className="text-xs text-white/55">Thinking...</div>
        ) : null}
        {showJumpToLatest ? (
          <button
            type="button"
            onClick={jumpToLatest}
            className="sticky bottom-0 self-end rounded-full border border-white/15 bg-black/60 px-3 py-1 text-[11px] font-medium text-white/80 backdrop-blur-sm transition hover:bg-black/75"
          >
            Jump to latest
          </button>
        ) : null}
      </section>

      <section className="border-white/8 flex shrink-0 grow-0 flex-col gap-3 border-t p-3">
        <div className="flex flex-col gap-3">
          {quickActions.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {quickActions.map((action) => (
                <button
                  key={action.id}
                  onClick={action.onClick}
                  disabled={isSending || isSelectionMode}
                  className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2.5 py-1 text-[11px] font-medium text-white/70 hover:bg-white/10 disabled:opacity-40"
                >
                  {action.label}
                </button>
              ))}
            </div>
          ) : null}

          {isSelectionMode ? (
            <div className="flex items-center justify-between rounded-lg border border-white/10 bg-black/20 px-3 py-2">
              <div className="text-xs text-white/70">
                Selected {selectedMessageIds.length} message
                {selectedMessageIds.length === 1 ? "" : "s"}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={clearSelectionMode}
                  className="rounded-md border border-white/10 px-2 py-1 text-[11px] text-white/80"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveSelectedMessagesAsAnnotation}
                  disabled={!canSaveToAnnotation}
                  title={
                    queuedSelection.trim()
                      ? "Create annotation with selected messages in comment"
                      : "Select text in Reader first"
                  }
                  className="rounded-md border border-white/10 px-2 py-1 text-[11px] text-white/80 disabled:opacity-40"
                >
                  {isSavingAnnotation ? "Saving..." : "Save to annotation"}
                </button>
              </div>
            </div>
          ) : null}

          <div className="rounded-lg border border-white/10 bg-black/10 p-3">
            <textarea
              data-can-scroll="true"
              className="min-h-[84px] w-full resize-none rounded-lg border border-white/10 bg-transparent px-3 py-3 text-[13px] leading-6 text-[var(--fill-primary)] outline-none placeholder:text-white/35 focus:border-[var(--accent-blue)]"
              rows={3}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Ask about the paper..."
              value={draft}
              disabled={isSending || isSelectionMode}
            />
            <div className="mt-2 flex items-center justify-between border-t border-white/5 pt-2">
              <div className="flex flex-wrap gap-2 text-[10px]">
                <span className="inline-flex items-center rounded-md border border-white/10 px-2 py-1 text-[11px] font-medium text-white/65">
                  {currentSettings.provider}
                </span>
                <span className="inline-flex items-center rounded-md border border-white/10 px-2 py-1 text-[11px] font-medium text-white/65">
                  {currentSettings.model}
                </span>
                {queuedSelection ? (
                  <span className="inline-flex items-center rounded-md border border-white/10 px-2 py-1 text-[11px] font-medium text-white/65">
                    Selection Ready
                  </span>
                ) : null}
              </div>
              <button
                disabled={!draft.trim() || isSending || isSelectionMode}
                onClick={() => send(draft)}
                className="rounded-lg bg-blue-600 px-4 py-1.5 text-[12px] font-bold shadow-lg transition hover:brightness-110 disabled:opacity-30"
              >
                {isSending ? "Sending..." : "Send"}
              </button>
            </div>
            {requestError ? (
              <div className="mt-2 text-xs text-red-300">{requestError}</div>
            ) : null}
          </div>
        </div>
      </section>
    </aside>
  );
}
