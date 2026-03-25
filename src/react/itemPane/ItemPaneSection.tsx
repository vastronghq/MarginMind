import { useEffect, useRef, useState } from "react";
import { generateAIReply, type AIChatMessage } from "../../modules/aiService";
import { loadAISettings } from "../../utils/aiPrefs";

type ItemPaneSectionProps = {
  data: {
    title: string;
    creators: string;
    year: string;
    abstractPreview: string;
    keyText: string;
  } | null;
  showSelectedText?: boolean;
  selectedText: string;
};

type ChatMessage = {
  id: string;
  role: "assistant" | "user" | "system";
  text: string;
  meta?: string;
};

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

function MessageBubble({ message }: { message: ChatMessage }) {
  const isAssistant = message.role === "assistant";
  const isSystem = message.role === "system";

  return (
    <div
      className={`flex ${isAssistant || isSystem ? "justify-start" : "justify-end"}`}
    >
      <div
        className={`min-w-0 max-w-[92%] rounded-2xl border px-3.5 py-3 ${
          isSystem
            ? "border-[var(--accent-blue)]/20 bg-[color-mix(in_srgb,var(--accent-blue)_10%,transparent)] text-[12px] text-white/75"
            : isAssistant
              ? "border-white/10 bg-white/5 text-[13px] text-[var(--fill-primary)]"
              : "border-[var(--accent-blue)]/35 bg-[color-mix(in_srgb,var(--accent-blue)_22%,transparent)] text-[13px] text-[var(--fill-primary)]"
        }`}
      >
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
}: ItemPaneSectionProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [queuedSelection, setQueuedSelection] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [requestError, setRequestError] = useState("");
  const selectionSignatureRef = useRef("");
  const itemSignature = data?.keyText ?? "";
  const asideRef = useRef<HTMLElement | null>(null);
  const messageRef = useRef<HTMLDivElement | null>(null);
  const currentSettings = loadAISettings();

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
    if (!messageContainer) return;
    messageContainer.scrollTo({
      top: messageContainer.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, isSending]);

  useEffect(() => {
    if (!data) {
      setMessages([]);
      setDraft("");
      setQueuedSelection("");
      setIsSending(false);
      setRequestError("");
      selectionSignatureRef.current = "";
      return;
    }

    setMessages(createInitialMessages());
    setDraft("");
    setQueuedSelection(showSelectedText ? selectedText : "");
    setRequestError("");
    selectionSignatureRef.current = showSelectedText ? selectedText : "";
  }, [itemSignature, data, selectedText, showSelectedText]);

  useEffect(() => {
    if (!data || !showSelectedText || !selectedText) return;
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
  }, [data, selectedText, showSelectedText]);

  if (!data) {
    return <EmptyPane />;
  }
  const itemData = data;

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
      `Title: ${itemData.title}`,
      `Creators: ${itemData.creators}`,
      `Year: ${itemData.year}`,
      `Key: ${itemData.keyText}`,
      `Abstract: ${itemData.abstractPreview}`,
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

      const reply = await generateAIReply({
        settings: currentSettings,
        messages: apiMessages,
      });
      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          text: reply,
          meta: `${currentSettings.provider} / ${currentSettings.model}`,
        },
      ]);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Request failed.";
      setRequestError(errorMessage);
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
            {itemData.title} / {itemData.creators} / {itemData.year} /{" "}
            {itemData.keyText}
          </div>
        </div>
      </section>

      <section
        data-can-scroll="true"
        ref={messageRef}
        className="flex max-h-[40vh] min-h-0 flex-1 flex-col gap-3 overflow-hidden overflow-y-auto p-3"
      >
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        {isSending ? (
          <div className="text-xs text-white/55">Thinking...</div>
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
                  disabled={isSending}
                  className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2.5 py-1 text-[11px] font-medium text-white/70 hover:bg-white/10 disabled:opacity-40"
                >
                  {action.label}
                </button>
              ))}
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
              disabled={isSending}
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
                disabled={!draft.trim() || isSending}
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
