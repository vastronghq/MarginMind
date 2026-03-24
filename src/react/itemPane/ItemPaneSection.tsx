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
  return `I have the paper context loaded. Ask for a summary, critique, rewrite, extraction, or use the reader selection as grounded evidence. ${data.creators} | ${data.year}`;
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
      // text: makeAssistantGreeting(data),
      text: "Hello! I'm your AI assistant. How can I help you today?",
      meta: "Greeting",
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
  const selectionSignatureRef = useRef("");
  const itemSignature = data?.keyText ?? "";
  const asideRef = useRef<HTMLElement | null>(null);
  const messageRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const aside = asideRef.current;
    if (!aside) return;

    const handleWheel = (e: WheelEvent) => {
      // 检查点击的目标或其父级是否带有 data-can-scroll 属性
      const isScrollableElement = (e.target as Element)?.closest(
        '[data-can-scroll="true"]',
      );

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
      {
        id: "summarize",
        label: "Summarize the paper",
        // 情况 A：调用 send 并传入特定字符串
        onClick: () => send("Summarize the main points of this paper."),
      },
      {
        id: "critique",
        label: "Critique the paper",
        // 情况 B：调用另一个函数并传参
        onClick: () => send("Critique the methodology."),
      },
      {
        id: "to-notes",
        label: "Turn selection into notes",
        onClick: () => send("Turn selection into notes."),
      },
      {
        id: "insert",
        label: "Insert into prompt",
        // 情况 D：直接转发引用（如果不需参数）
        onClick: useSelection,
      },
    ],
    [send, useSelection],
  ); // 必须包含依赖，否则函数内部拿到的数据是旧的

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
      ref={asideRef}
      className="flex max-h-[80vh] min-h-0 w-full flex-col overflow-hidden bg-[var(--material-sidepane)] text-[var(--fill-primary)]"
    >
      {/* Header */}
      {/* <section className="flex shrink-0 items-center gap-3 p-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-[13px] font-semibold shadow-inner">
          C
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-[13px] font-semibold text-blue-400">
              Cline Research
            </span>
          </div>
          <div className="text-[11px] text-white/50">{itemData.title}</div>
        </div>
      </section> */}

      <section className="flex shrink-0 grow-0 flex-col justify-center gap-3 p-3">
        {/* Context Bar */}
        <div className="rounded-lg border border-white/10 bg-black/10 p-3 text-[12px] leading-relaxed text-white/60">
          <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-white/30">
            Context:
          </div>
          <div className="text-md">
            {itemData.title} / {itemData.creators} / {itemData.year} /{" "}
            {itemData.keyText}
          </div>
        </div>
      </section>

      {/* Main: 滚动区域 */}
      <section
        data-can-scroll="true"
        ref={messageRef}
        className="flex max-h-[40vh] min-h-0 flex-1 flex-col gap-3 overflow-hidden overflow-y-auto p-3"
      >
        {/* Messages */}
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
      </section>

      {/* Footer: 与 Header/Main 保持一致的 Padding 和边框风格 */}
      <section className="border-white/8 flex shrink-0 grow-0 flex-col gap-3 border-t p-3">
        {/* Selection Preview */}
        {/* {queuedSelection && (
          <div className="rounded-lg border border-white/10 bg-black/10 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">
                Reader Selection
              </span>
              <button
                onClick={useSelection}
                className="inline-flex items-center rounded-md border border-white/10 px-2 py-1 text-[11px] font-medium text-blue-400 text-white/65 hover:bg-blue-500/20"
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
        )} */}

        {/* Quick Actions & Composer Container */}
        <div className="flex flex-col gap-3">
          {quickActions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {quickActions.map((action) => (
                <button
                  key={action.id}
                  onClick={action.onClick}
                  className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2.5 py-1 text-[11px] font-medium text-white/70 hover:bg-white/10"
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}

          <div className="rounded-lg border border-white/10 bg-black/10 p-3">
            <textarea
              data-can-scroll="true"
              className="min-h-[84px] w-full resize-none rounded-lg border border-white/10 bg-transparent px-3 py-3 text-[13px] leading-6 text-[var(--fill-primary)] outline-none placeholder:text-white/35 focus:border-[var(--accent-blue)]"
              rows={3}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Ask about the paper..."
              value={draft}
            />
            <div className="mt-2 flex items-center justify-between border-t border-white/5 pt-2">
              <div className="flex gap-2 text-[10px]">
                <span className="inline-flex items-center rounded-md border border-white/10 px-2 py-1 text-[11px] font-medium text-white/65 opacity-50">
                  Paper Loaded
                </span>
                <span className="inline-flex items-center rounded-md border border-white/10 px-2 py-1 text-[11px] font-medium text-blue-400 text-white/65">
                  stepfun/step-3.5-flash:free
                </span>
                {queuedSelection && (
                  <span className="inline-flex items-center rounded-md border border-white/10 px-2 py-1 text-[11px] font-medium text-blue-400 text-white/65">
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
      </section>
    </aside>
  );
}
