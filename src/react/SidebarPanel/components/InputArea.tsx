import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  loadPresets,
  applyPreset,
  loadAISettings,
} from "../../../modules/aiPrefs";
import { MarkdownParseButton } from "./MarkdownParseButton";
import { useState, useMemo } from "react";
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
  messages: { role: string; text: string }[];
  markdownContent: string | null;
  tokenStats: {
    totalInputTokens: number;
    totalOutputTokens: number;
    currentContextTokens: number;
  };
  onTokenCount: (stats: {
    totalInputTokens: number;
    totalOutputTokens: number;
    currentContextTokens: number;
  }) => void;
  // SelectionModeBar props
  selectedIDs: string[];
  onSaveToAnnotation: () => void;
  canSaveToAnnotation: boolean;
  isSavingAnnotation: boolean;
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
  tokenStats,
  onTokenCount,
  selectedIDs,
  onSaveToAnnotation,
  canSaveToAnnotation,
  isSavingAnnotation,
  onCancel,
}: InputAreaProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [presetVersion, setPresetVersion] = useState(0);
  const presets = useMemo(() => loadPresets(), [presetVersion]);
  const settings = useMemo(() => loadAISettings(), [presetVersion]);

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
      const enc = encodingForModel("gpt-4o");
      let totalInputTokens = 0;
      let totalOutputTokens = 0;
      let runningContext = 0;

      for (let i = 0; i < messages.length; i++) {
        const msg = messages[i] as ChatMessage;
        const msgTokens = enc.encode(msg.text || "").length + 4;

        if (msg.role === "user") {
          const currentInput = runningContext + msgTokens;
          totalInputTokens += currentInput;
          runningContext += msgTokens;
        } else if (msg.role === "assistant") {
          totalOutputTokens += msgTokens;
          runningContext += msgTokens;
        }
      }

      onTokenCount({
        totalInputTokens,
        totalOutputTokens,
        currentContextTokens: runningContext,
      });
    } catch (e) {
      console.error("Token calculation failed:", e);
      onTokenCount({
        totalInputTokens: 0,
        totalOutputTokens: 0,
        currentContextTokens: 0,
      });
    }
  };

  const shouldExpand = isFocused || draft.trim().length > 0;

  return (
    <section className="space-y-2 border-t border-[color-mix(in_srgb,var(--fill-primary)_16%,transparent)] p-2.5">
      <div className="flex w-full flex-wrap items-center justify-start gap-x-2 gap-y-2">
        <MarkdownParseButton
          status={markdownStatus}
          onClick={onParse}
          parseProgress={parseProgress}
        />
        <button
          type="button"
          onClick={() => onSend(getSummarizePrompt())}
          disabled={isSending || isSelectionMode}
          className="inline-flex shrink-0 items-center gap-1 rounded px-1 py-0.5 text-[11px] transition hover:bg-[color-mix(in_srgb,var(--fill-primary)_10%,transparent)] disabled:opacity-40"
        >
          Summarize
        </button>
        <button
          type="button"
          onClick={handleTokenCount}
          title="Estimated token usage based on local calculation"
          className="inline-flex shrink-0 items-center gap-1 rounded px-1 py-0.5 text-[11px] transition hover:bg-[color-mix(in_srgb,var(--fill-primary)_10%,transparent)]"
        >
          {tokenStats.totalInputTokens > 0 ||
          tokenStats.totalOutputTokens > 0 ||
          tokenStats.currentContextTokens > 0
            ? `In ${formatTokens(tokenStats.totalInputTokens)} • Out ${formatTokens(tokenStats.totalOutputTokens)} • Ctx ${formatTokens(tokenStats.currentContextTokens)}`
            : "Tokens"}
        </button>
      </div>

      {isSelectionMode ? (
        <SelectionModeBar
          selectedCount={selectedIDs.length}
          onSaveToAnnotation={onSaveToAnnotation}
          canSaveToAnnotation={canSaveToAnnotation}
          isSavingAnnotation={isSavingAnnotation}
          onCancel={onCancel}
        />
      ) : null}

      <Card className="border-[color-mix(in_srgb,var(--fill-primary)_16%,transparent)] bg-[color-mix(in_srgb,var(--material-sidepane)_90%,var(--fill-primary)_7%)] p-2.5">
        <CardContent className="space-y-2 p-0">
          <textarea
            // ref={textareaRef}
            // rows={shouldExpand ? 10 : 1}
            style={{
              height: shouldExpand ? "240px" : "24px",
              transition: "height 0.3s ease",
            }}
            placeholder="Ask about the paper..."
            value={draft}
            onChange={(e) => onDraftChange(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onKeyDown={handleKeyDown}
            // disabled={isSending || isSelectionMode}
            className="w-full resize-none border-[color-mix(in_srgb,var(--fill-primary)_16%,transparent)] bg-transparent text-[14px] leading-6 text-[var(--fill-primary)] placeholder:text-[color-mix(in_srgb,var(--fill-primary)_38%,transparent)]"
          />

          <Separator className="bg-[color-mix(in_srgb,var(--fill-primary)_12%,transparent)]" />

          <div className="flex items-center justify-between gap-2">
            <select
              value={activePreset?.name ?? "__custom__"}
              onChange={(e) => {
                const preset = presets.find((p) => p.name === e.target.value);
                if (preset) {
                  applyPreset(preset);
                  setPresetVersion((v) => v + 1);
                }
              }}
              disabled={isSending}
              className="flex-1 cursor-pointer bg-transparent px-3 py-0 text-[12px] text-[color-mix(in_srgb,var(--fill-primary)_68%,transparent)]"
            >
              {!activePreset ? (
                <option value="__custom__" disabled>
                  {settings.provider} / {settings.model}
                </option>
              ) : null}
              {presets.length === 0 ? (
                <option value="" disabled>
                  No presets configured
                </option>
              ) : (
                presets.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name}
                  </option>
                ))
              )}
            </select>
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
  onCancel: () => void;
}

export function SelectionModeBar({
  selectedCount,
  onSaveToAnnotation,
  canSaveToAnnotation,
  isSavingAnnotation,
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
