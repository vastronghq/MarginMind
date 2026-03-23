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
  const sectionRef = useRef(null);
  const messageRef = useRef(null);

  useEffect(() => {
    const aside = sectionRef.current;
    if (!aside) return;

    const handleWheel = (e) => {
      // 检查点击的目标或其父级是否带有 data-can-scroll 属性
      const isScrollableElement = e.target.closest('[data-can-scroll="true"]');

      if (isScrollableElement) {
        // 检查当前元素是否已经滚到底部或顶部
        // 如果已经到底还继续滚，默认会触发父级（Aside）滚动，这里阻止它
        const { scrollTop, scrollHeight, clientHeight } = isScrollableElement;
        const isAtTop = e.deltaY < 0 && scrollTop <= 0;
        const isAtBottom =
          e.deltaY > 0 && scrollTop + clientHeight >= scrollHeight;

        if (isAtTop || isAtBottom) {
          // 只有当子容器滚不动时，才阻止
          e.preventDefault();
        }

        // 在子容器内滚动，允许默认行为，但阻止事件冒泡到 aside
        e.stopPropagation();
      } else {
        // 鼠标在 Header 或 Footer 其他空白处，直接禁用滚动
        e.preventDefault();
      }
    };

    // 必须使用 passive: false 才能 preventDefault
    aside.addEventListener("wheel", handleWheel, { passive: false });
    return () => aside.removeEventListener("wheel", handleWheel);
  }, []); // 确保依赖项正确

  useEffect(() => {
    const messageContainer = messageRef.current;
    if (messageContainer) {
      // 方案 A: 瞬间跳到底部
      // messageContainer.scrollTop = scrollContainer.scrollHeight;

      // 方案 B: 平滑滚动到底部 (体验更好)
      messageContainer.scrollTo({
        top: messageContainer.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages]); // 核心：监听 messages 数组的变化

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
    <aside
      ref={sectionRef}
      className="cline-shell flex max-h-[80vh] flex-col overflow-hidden text-white"
    >
      {/* Header */}
      <header className="flex shrink-0 items-center gap-3 border-b border-white/8 p-3">
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
      </header>

      {/* Main: 滚动区域 */}
      <main
        data-can-scroll="true"
        ref={messageRef}
        className="cline-scrollbar flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3"
      >
        {/* Context Bar */}
        <div className="cline-panel flex flex-wrap gap-2 px-3 py-2 text-[11px] text-white/60">
          <span className="font-medium text-white/80">Context:</span>
          <span>{itemData.creators}</span>
          <span className="opacity-20">/</span>
          <span>{itemData.year}</span>
          <span className="truncate italic opacity-80">{itemData.keyText}</span>
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

      {/* Footer: 与 Header/Main 保持一致的 Padding 和边框风格 */}
      <footer className="flex shrink-0 flex-col gap-3 border-t border-white/8 p-3">
        {/* Selection Preview */}
        {queuedSelection && (
          <div className="cline-panel p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">
                Reader Selection
              </span>
              <button
                onClick={useSelection}
                className="cline-tool-pill text-blue-400 hover:bg-blue-500/20"
              >
                Insert Into Prompt
              </button>
            </div>
            <div
              data-can-scroll="true"
              className="max-h-20 overflow-y-auto rounded-lg bg-black/20 p-2 text-[12px] text-white/70"
            >
              {queuedSelection}
            </div>
          </div>
        )}

        {/* Quick Actions & Composer Container */}
        <div className="flex flex-col gap-3">
          {quickActions.length > 0 && (
            <div className="flex flex-wrap gap-2">
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
          )}

          <div className="cline-panel p-3">
            <textarea
              data-can-scroll="true"
              className="cline-composer w-full resize-none bg-transparent text-[13px] outline-none"
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
        </div>
      </footer>
    </aside>
  );
}
