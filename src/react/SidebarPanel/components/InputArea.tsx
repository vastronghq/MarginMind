import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronDown } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  loadPresets,
  applyPreset,
  loadAISettings,
} from "../../../modules/aiPrefs";
import { getPref } from "../../../utils/prefs";
import { PROMPTS } from "../utils";
import { MarkdownParseButton } from "./markdown-parse-button";
import { useState, useRef, useEffect } from "react";
import { encodingForModel } from "js-tiktoken";

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
  const presets = loadPresets();
  const settings = loadAISettings();
  const [isPresetOpen, setIsPresetOpen] = useState(false);
  const [presetPos, setPresetPos] = useState({ left: 0, bottom: 0 });
  const presetDropdownRef = useRef<HTMLDivElement>(null);
  const annotationColor = getPref("annotationColor");

  const activePreset = presets.find(
    (p) =>
      p.settings.provider === settings.provider &&
      p.settings.apiKey === settings.apiKey &&
      p.settings.baseURL === settings.baseURL &&
      p.settings.model === settings.model,
  );

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
      const enc = encodingForModel("gpt-4o");
      let tokens = 0;

      for (const msg of messages) {
        tokens += enc.encode(msg.text).length;
      }

      const isFirstRound = messages.length === 0;
      if (isFirstRound && markdownContent) {
        tokens += enc.encode(markdownContent).length;
      }

      onTokenCount(tokens);
    } catch {
      onTokenCount(0);
    }
  };

  return (
    <section className="space-y-2 border-t border-[color-mix(in_srgb,var(--fill-primary)_16%,transparent)] p-2.5">
      <div className="flex w-full items-center gap-2">
        <div className="flex-none">
          <MarkdownParseButton
            status={markdownStatus}
            onClick={onParse}
            parseProgress={parseProgress}
          />
        </div>

        <div className="flex flex-1 flex-wrap items-center gap-1 rounded-md border-[1px] border-dashed border-[var(--accent-blue)] px-2 py-0.5">
          <span className="whitespace-nowrap text-[11px] font-medium uppercase tracking-wider">
            Quick Action:
          </span>
          <Button
            size="xs"
            variant="outline"
            onClick={() => onSend(PROMPTS.summarizeFullText)}
            disabled={isSending || isSelectionMode}
            className="rounded-full border-[1px] border-[color-mix(in_srgb,var(--fill-primary)_16%,transparent)] bg-[color-mix(in_srgb,var(--material-sidepane)_88%,var(--fill-primary)_8%)] px-2 text-[12px] text-[color-mix(in_srgb,var(--fill-primary)_78%,transparent)]"
          >
            Summarize
          </Button>
          <Button
            size="xs"
            variant="outline"
            onClick={handleTokenCount}
            className="ml-auto rounded-full border-[1px] border-[color-mix(in_srgb,var(--fill-primary)_16%,transparent)] bg-[color-mix(in_srgb,var(--material-sidepane)_88%,var(--fill-primary)_8%)] px-2 text-[12px] text-[color-mix(in_srgb,var(--fill-primary)_78%,transparent)]"
          >
            {totalTokens > 0
              ? `~${totalTokens.toLocaleString()} tokens`
              : "0 tokens"}
          </Button>
        </div>
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
            disabled={isSending || isSelectionMode}
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
