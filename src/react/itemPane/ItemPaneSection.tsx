import { useEffect, useMemo, useRef, useState } from "react";

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

function makeAssistantGreeting(
  data: NonNullable<ItemPaneSectionProps["data"]>,
) {
  return "I have the paper context loaded. Ask for a summary, critique, rewrite, extraction, or use the reader selection as grounded evidence.";
}

function makeSelectionPrompt(selection: string) {
  return `Use this selection as evidence and explain its role in the paper:\n\n${selection}`;
}

function makeAssistantReply(args: {
  prompt: string;
  data: NonNullable<ItemPaneSectionProps["data"]>;
  selectedText: string;
}) {
  const { prompt, data, selectedText } = args;
  const focus = selectedText
    ? `I will ground the response in the current reader selection first, then connect it back to ${data.title}.`
    : `I will ground the response in the paper metadata and abstract for ${data.title}.`;

  return `${focus}\n\nSuggested next step: ${prompt}\n\nWorking context: ${data.creators} | ${data.year}`;
}

function createInitialMessages(
  data: NonNullable<ItemPaneSectionProps["data"]>,
): ChatMessage[] {
  return [
    {
      id: "assistant-greeting",
      role: "assistant",
      text: makeAssistantGreeting(data),
      meta: "Context ready",
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
        className={`max-w-[92%] min-w-0 rounded-2xl border px-3.5 py-3 ${
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
    <div className="cline-shell w-full min-w-0 rounded-xl border border-white/10 px-4 py-5 text-[var(--fill-primary)]">
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
  const selectionSignatureRef = useRef("");
  const itemSignature = data?.keyText ?? "";

  useEffect(() => {
    if (!data) {
      setMessages([]);
      setDraft("");
      setQueuedSelection("");
      selectionSignatureRef.current = "";
      return;
    }

    setMessages(createInitialMessages(data));
    setDraft("");
    setQueuedSelection(showSelectedText ? selectedText : "");
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

  const quickActions = useMemo(
    () => [
      "Summarize the paper",
      "Extract the main claim",
      "Critique the argument",
      "Turn selection into notes",
    ],
    [],
  );

  if (!data) {
    return <EmptyPane />;
  }

  const itemData = data;

  function send(prompt: string) {
    const trimmed = prompt.trim();
    if (!trimmed) return;

    const stamp = Date.now();
    setMessages((current) => [
      ...current,
      {
        id: `user-${stamp}`,
        role: "user",
        text: trimmed,
      },
      {
        id: `assistant-${stamp}`,
        role: "assistant",
        text: makeAssistantReply({
          prompt: trimmed,
          data: itemData,
          selectedText: queuedSelection,
        }),
        meta: queuedSelection
          ? "Using selection context"
          : "Using paper context",
      },
    ]);
    setDraft("");
  }

  function useSelection() {
    if (!queuedSelection) return;
    const nextDraft = draft.trim()
      ? `${draft.trim()}\n\n${makeSelectionPrompt(queuedSelection)}`
      : makeSelectionPrompt(queuedSelection);
    setDraft(nextDraft);
  }

  return (
    <section className="cline-shell flex h-full flex-col overflow-hidden text-white">
      {/* Header: 合并了原有的两个 header 层 */}
      <header className="shrink-0 border-b border-white/8 p-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-[13px] font-semibold shadow-inner">
            C
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-[13px] font-semibold text-blue-400">
                Cline Research
              </span>
              <span className="cline-badge text-[10px]">Claude 3.5</span>
            </div>
            <div className="text-[11px] text-white/50">{itemData.title}</div>
          </div>
        </div>
      </header>

      {/* Main: 滚动区域 */}
      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto cline-scrollbar p-3 space-y-3">
        {/* Context Bar */}
        <div className="cline-panel flex flex-wrap gap-2 px-3 py-2 text-[11px] text-white/60">
          <span className="font-medium text-white/80">Context:</span>
          <span>{itemData.creators}</span>
          <span className="opacity-20">/</span>
          <span>{itemData.year}</span>
          <span className="truncate opacity-80 italic">{itemData.keyText}</span>
        </div>

        {/* System Prompt */}
        <div className="cline-panel p-3 text-[12px] leading-relaxed text-white/60">
          <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-white/30">
            System
          </div>
          Abstract context preloaded. Grounded in paper and selection.
        </div>

        {/* Messages */}
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
      </main>

      {/* Footer: 输入区域 */}
      <footer className="shrink-0 border-t border-white/8 p-3">
        {/* Selection Preview - 仅在有内容时渲染 */}
        {queuedSelection && (
          <div className="cline-panel mb-3 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">
                Reader Selection
              </span>
              <button
                onClick={useSelection}
                className="cline-tool-pill hover:bg-blue-500/20 text-blue-400"
              >
                Insert Into Prompt
              </button>
            </div>
            <div className="max-h-20 overflow-y-auto rounded-lg bg-black/20 p-2 text-[12px] text-white/70">
              {queuedSelection}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="mb-3 flex flex-wrap gap-2">
          {quickActions.map((action) => (
            <button
              key={action}
              onClick={() => send(action)}
              className="cline-badge hover:bg-white/10"
            >
              {action}
            </button>
          ))}
        </div>

        {/* Composer */}
        <div className="cline-panel p-3">
          <textarea
            className="cline-composer w-full bg-transparent outline-none resize-none text-[13px]"
            rows={3}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ask about the paper..."
            value={draft}
          />
          <div className="mt-2 flex items-center justify-between border-t border-white/5 pt-2">
            <div className="flex gap-2 text-[10px]">
              <span className="cline-tool-pill opacity-50">Paper Loaded</span>
              {queuedSelection && (
                <span className="cline-tool-pill text-blue-400">
                  Selection Ready
                </span>
              )}
            </div>
            <button
              disabled={!draft.trim()}
              onClick={() => send(draft)}
              className="rounded-lg bg-blue-600 px-4 py-1.5 text-[12px] font-bold shadow-lg transition hover:brightness-110 disabled:opacity-30"
            >
              Send Message
            </button>
          </div>
        </div>
      </footer>
    </section>
  );
}
