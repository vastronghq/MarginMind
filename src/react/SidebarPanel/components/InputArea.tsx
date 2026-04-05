import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { ChevronDown, Sparkles } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  loadPresets,
  applyPreset,
  loadAISettings,
} from "../../../modules/aiPrefs";
import { MarkdownParseButton } from "./MarkdownParseButton";
import { useState, useRef, useEffect, useMemo } from "react";
import { encodingForModel } from "js-tiktoken";
import type { ChatMessage } from "../hooks/useChatSession";
import { getSummarizePrompt } from "../../../modules/popupButtons";

interface InputAreaProps {
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: (prompt: string) => void;
  onStop: () => void;
  onClear: () => void;
  isSending: boolean;
  isSelectionMode: boolean;
  markdownStatus: "none" | "cached" | "parsing" | "error";
  parseProgress: string;
  onParse: () => void;
  messages: { text: string }[];
  markdownContent: string | null;
  totalTokens: number;
  onTokenCount: (count: number) => void;
  // SelectionModeBar props
  selectedIDs: string[];
  onSaveToAnnotation: () => void;
  canSaveToAnnotation: boolean;
  isSavingAnnotation: boolean;
  onDelete: () => void;
  canDelete: boolean;
  onCancel: () => void;
}

export function InputArea({
  draft,
  onDraftChange,
  onSend,
  onStop,
  onClear,
  isSending,
  isSelectionMode,
  markdownStatus,
  parseProgress,
  onParse,
  messages,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  markdownContent,
  totalTokens,
  onTokenCount,
  selectedIDs,
  onSaveToAnnotation,
  canSaveToAnnotation,
  isSavingAnnotation,
  onDelete,
  canDelete,
  onCancel,
}: InputAreaProps) {
  const [isPresetOpen, setIsPresetOpen] = useState(false);
  const [presetPos, setPresetPos] = useState({ left: 0, bottom: 0 });
  const presetDropdownRef = useRef<HTMLDivElement>(null);
  const presets = useMemo(() => loadPresets(), [isPresetOpen]);
  const settings = useMemo(() => loadAISettings(), [isPresetOpen]);

  const activePreset = useMemo(
    () =>
      presets.find(
        (p) =>
          p.settings.provider === settings.provider &&
          p.settings.apiKey === settings.apiKey &&
          p.settings.baseURL === settings.baseURL &&
          p.settings.model === settings.model,
      ),
    [presets, settings],
  );

  const formatTokens = (n: number) => {
    if (n < 1_000) return `${n}`;
    if (n < 1_000_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
    return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  };

  useEffect(() => {
    if (!isPresetOpen) return;
    const onDown = (e: MouseEvent) => {
      if (
        presetDropdownRef.current &&
        !presetDropdownRef.current.contains(e.target as Node)
      ) {
        setIsPresetOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [isPresetOpen]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter" || e.shiftKey) return;
    if (e.nativeEvent.isComposing) return;
    e.preventDefault();
    if (isSelectionMode || (!isSending && !draft.trim())) return;
    if (isSending) {
      onStop();
      return;
    }
    onSend(draft);
  };

  const handleTokenCount = () => {
    try {
      // 建议使用 gpt-4o 或 cl100k_base 编码器，因为它们是目前最通用的
      const enc = encodingForModel("gpt-4o");
      let totalBillableTokens = 0; // 累计总花费（钱）
      let currentContextTokens = 0; // 当前上下文长度（空间）

      // 假设每一轮对话的消息都存在 messages 数组里
      // 我们需要模拟每一轮发送请求时的状态
      for (let i = 0; i < messages.length; i++) {
        const msg = messages[i] as ChatMessage;
        const msgTokens = enc.encode(msg.text || "").length + 4; // +4 是消息结构开销

        // 1. 更新当前上下文的总量
        currentContextTokens += msgTokens;

        // 2. 关键：只有当这一条消息是“用户发送”的时候，才代表产生了一次 API 调用
        // 每一轮 API 调用的花费 = 当时发送给 AI 的所有上下文 + AI 随后返回的内容
        if (msg.role === "assistant" || i === messages.length - 1) {
          // 实际上，每一轮的总花费就是当前所有消息的总和
          // 我们在每一轮结束（AI 回答完）时，累加这一次调用的总 Token
          if (msg.role === "assistant") {
            totalBillableTokens += currentContextTokens;
          }
        }
      }

      // 如果你想显示的是“当前这一轮发送会消耗多少”
      // 则直接使用 currentContextTokens
      // 如果你想显示的是“这个会话总共花了多少”，则使用 totalBillableTokens
      onTokenCount(totalBillableTokens);
    } catch (e) {
      console.error("Token calculation failed:", e);
      onTokenCount(0);
    }
  };

  return (
    <section className="space-y-2 border-t border-[color-mix(in_srgb,var(--fill-primary)_16%,transparent)] p-2.5">
      <div className="flex w-full items-center justify-start gap-2">
        <MarkdownParseButton
          status={markdownStatus}
          onClick={onParse}
          parseProgress={parseProgress}
        />
        <Button
          size="xs"
          variant="outline"
          onClick={() => onSend(getSummarizePrompt())}
          disabled={isSending || isSelectionMode}
          className="rounded-full border-[1px] border-[color-mix(in_srgb,var(--fill-primary)_16%,transparent)] bg-[color-mix(in_srgb,var(--material-sidepane)_88%,var(--fill-primary)_8%)] px-2 text-[12px] text-[color-mix(in_srgb,var(--fill-primary)_78%,transparent)]"
        >
          Summarize
        </Button>
        <Button
          size="xs"
          variant="outline"
          onClick={handleTokenCount}
          title="Estimated token usage based on local calculation"
          className="rounded-full border-[1px] border-[color-mix(in_srgb,var(--fill-primary)_16%,transparent)] bg-[color-mix(in_srgb,var(--material-sidepane)_88%,var(--fill-primary)_8%)] px-2 text-[12px] text-[color-mix(in_srgb,var(--fill-primary)_78%,transparent)]"
        >
          {totalTokens > 0 ? `~${formatTokens(totalTokens)}` : "Tokens"}
        </Button>
      </div>

      {isSelectionMode ? (
        <SelectionModeBar
          selectedCount={selectedIDs.length}
          onSaveToAnnotation={onSaveToAnnotation}
          canSaveToAnnotation={canSaveToAnnotation}
          isSavingAnnotation={isSavingAnnotation}
          onDelete={onDelete}
          canDelete={canDelete}
          onCancel={onCancel}
        />
      ) : null}

      <Card className="border-[color-mix(in_srgb,var(--fill-primary)_16%,transparent)] bg-[color-mix(in_srgb,var(--material-sidepane)_90%,var(--fill-primary)_7%)] p-2.5">
        <CardContent className="space-y-2 p-0">
          <textarea
            rows={4}
            placeholder="Ask about the paper..."
            value={draft}
            onChange={(e) => onDraftChange(e.target.value)}
            onKeyDown={handleKeyDown}
            // disabled={isSending || isSelectionMode}
            className="w-full resize-none border-[color-mix(in_srgb,var(--fill-primary)_16%,transparent)] bg-transparent text-[14px] leading-6 text-[var(--fill-primary)] placeholder:text-[color-mix(in_srgb,var(--fill-primary)_38%,transparent)]"
          />

          <Separator className="bg-[color-mix(in_srgb,var(--fill-primary)_12%,transparent)]" />

          <div className="flex items-center justify-between gap-2">
            <div ref={presetDropdownRef} className="relative w-fit flex-1">
              <button
                type="button"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setPresetPos({
                    left: rect.left,
                    bottom: window.innerHeight - rect.top + 4,
                  });
                  setIsPresetOpen((v) => !v);
                }}
                disabled={isSending}
                className="flex cursor-pointer items-center gap-1 bg-transparent px-0 py-0 text-left text-[12px] text-[color-mix(in_srgb,var(--fill-primary)_68%,transparent)] transition hover:text-[color-mix(in_srgb,var(--fill-primary)_90%,transparent)]"
              >
                <span className="line-clamp-1 pl-3">
                  {activePreset
                    ? activePreset.name
                    : `${settings.provider} / ${settings.model}`}
                </span>
                <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
              </button>
              {isPresetOpen ? (
                <div
                  style={{
                    position: "fixed",
                    left: presetPos.left,
                    bottom: presetPos.bottom,
                  }}
                  className="z-50 max-h-[200px] max-w-[300px] overflow-y-auto rounded-lg border border-[color-mix(in_srgb,var(--fill-primary)_16%,transparent)] bg-[color-mix(in_srgb,var(--material-sidepane)_82%,var(--fill-primary)_12%)] py-1 shadow-lg"
                >
                  {presets.length === 0 ? (
                    <div className="px-3 py-2 text-[12px] text-[color-mix(in_srgb,var(--fill-primary)_48%,transparent)]">
                      No presets configured
                    </div>
                  ) : (
                    presets.map((p) => (
                      <button
                        key={p.name}
                        type="button"
                        onClick={() => {
                          applyPreset(p);
                          setIsPresetOpen(false);
                        }}
                        className={cn(
                          "w-full cursor-pointer px-3 py-1.5 text-left text-[12px] transition",
                          activePreset?.name === p.name
                            ? "bg-[color-mix(in_srgb,var(--accent-blue)_12%,transparent)] text-[var(--fill-primary)]"
                            : "text-[color-mix(in_srgb,var(--fill-primary)_78%,transparent)] hover:bg-[color-mix(in_srgb,var(--fill-primary)_6%,transparent)]",
                        )}
                      >
                        {p.name}
                      </button>
                    ))
                  )}
                </div>
              ) : null}
            </div>
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={onClear}
              disabled={isSelectionMode || !draft.trim() || isSending}
              className="h-7 border-[color-mix(in_srgb,var(--fill-primary)_16%,transparent)] bg-[color-mix(in_srgb,var(--material-sidepane)_88%,var(--fill-primary)_8%)] px-2.5 text-[12px] text-[color-mix(in_srgb,var(--fill-primary)_82%,transparent)]"
            >
              Clear
            </Button>
            <Button
              onClick={isSending ? onStop : () => onSend(draft)}
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
        </CardContent>
      </Card>
    </section>
  );
}

interface SelectionModeBarProps {
  selectedCount: number;
  onSaveToAnnotation: () => void;
  canSaveToAnnotation: boolean;
  isSavingAnnotation: boolean;
  onDelete: () => void;
  canDelete: boolean;
  onCancel: () => void;
}

export function SelectionModeBar({
  selectedCount,
  onSaveToAnnotation,
  canSaveToAnnotation,
  isSavingAnnotation,
  onDelete,
  canDelete,
  onCancel,
}: SelectionModeBarProps) {
  return (
    <Card className="border-[color-mix(in_srgb,var(--fill-primary)_16%,transparent)] bg-red-500/20 px-2.5 py-1.5">
      <CardContent className="flex items-center justify-between p-0">
        <div className="text-[13px] text-[color-mix(in_srgb,var(--fill-primary)_72%,transparent)]">
          Selected {selectedCount} message{selectedCount === 1 ? "" : "s"}
        </div>
        <div className="">
          <Button
            type="button"
            size="xs"
            variant="outline"
            onClick={onSaveToAnnotation}
            disabled={!canSaveToAnnotation}
            className="h-7 border-[color-mix(in_srgb,var(--fill-primary)_16%,transparent)] bg-transparent px-2 text-[12px] text-[color-mix(in_srgb,var(--fill-primary)_82%,transparent)]"
          >
            {isSavingAnnotation ? "Saving..." : "Save to selection"}
          </Button>
          <Button
            type="button"
            size="xs"
            variant="outline"
            onClick={onDelete}
            disabled={!canDelete}
            className="h-7 border-[color-mix(in_srgb,var(--fill-primary)_16%,transparent)] bg-transparent px-2 text-[12px] text-[color-mix(in_srgb,var(--fill-primary)_82%,transparent)]"
          >
            Delete
          </Button>
          <Button
            type="button"
            size="xs"
            variant="outline"
            onClick={onCancel}
            className="h-7 border-[color-mix(in_srgb,var(--fill-primary)_16%,transparent)] bg-transparent px-2 text-[12px] text-[color-mix(in_srgb,var(--fill-primary)_82%,transparent)]"
          >
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
