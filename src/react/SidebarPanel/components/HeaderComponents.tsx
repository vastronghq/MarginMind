import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronDown, History, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatSession } from "../hooks/useChatSession";
import { toTime } from "../utils";
import type { SidebarPanelData } from "../../bridge";

interface HistoryPanelProps {
  sessions: ChatSession[];
  activeSessionID: string;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onClose: () => void;
  onClearSelection: () => void;
  isSending: boolean;
}

export function HistoryPanel({
  sessions,
  activeSessionID,
  onSelectSession,
  onDeleteSession,
  onClose,
  onClearSelection,
  isSending,
}: HistoryPanelProps) {
  return (
    <Card className="border-[color-mix(in_srgb,var(--fill-primary)_16%,transparent)] bg-[color-mix(in_srgb,var(--material-sidepane)_86%,var(--fill-primary)_8%)] p-1.5">
      <CardContent className="max-h-[240px] space-y-2 overflow-y-auto p-0 pr-1">
        {sessions
          .slice()
          .sort((a, b) => b.updatedAt - a.updatedAt)
          .map((session) => {
            const active = session.id === activeSessionID;
            return (
              <div
                key={session.id}
                className={cn(
                  "flex items-center rounded-lg border transition",
                  active
                    ? "border-2 border-solid border-[var(--accent-blue)] bg-[color-mix(in_srgb,var(--accent-blue)_20%,transparent)]"
                    : "border-[color-mix(in_srgb,var(--fill-primary)_16%,transparent)] bg-[color-mix(in_srgb,var(--material-sidepane)_82%,var(--fill-primary)_8%)] hover:bg-[color-mix(in_srgb,var(--material-sidepane)_78%,var(--fill-primary)_12%)]",
                )}
              >
                <button
                  type="button"
                  disabled={isSending}
                  onClick={() => {
                    onSelectSession(session.id);
                    onClose();
                    onClearSelection();
                  }}
                  className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 py-1 text-left"
                >
                  <div className="line-clamp-1 flex-1 text-[13px] font-medium text-[var(--fill-primary)]">
                    {session.title}
                  </div>
                  <div className="shrink-0 text-[12px] text-[color-mix(in_srgb,var(--fill-primary)_56%,transparent)]">
                    <span>
                      {toTime(session.updatedAt)} | {session.messages.length}
                    </span>
                  </div>
                </button>

                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  disabled={isSending}
                  title="Delete session"
                  onClick={() => onDeleteSession(session.id)}
                  className="hrink-0 rounded-md text-[color-mix(in_srgb,var(--fill-primary)_62%,transparent)] hover:bg-[color-mix(in_srgb,var(--fill-primary)_12%,transparent)] hover:text-[var(--accent-red,#d14)]"
                >
                  <Trash2 />
                </Button>
              </div>
            );
          })}
      </CardContent>
    </Card>
  );
}

interface HeaderBarProps {
  // isHistoryOpen: boolean;
  onToggleHistory: () => void;
  onNewChat: () => void;
  isSending: boolean;
  activeContext: SidebarPanelData | null;
}

export function HeaderBar({
  // isHistoryOpen,
  onToggleHistory,
  onNewChat,
  isSending,
  activeContext,
}: HeaderBarProps) {
  return (
    <div className="flex items-center gap-1.5">
      {activeContext ? (
        <ContextBadge
          title={activeContext.title}
          creators={activeContext.creators}
          year={activeContext.year}
          keyText={activeContext.keyText}
        />
      ) : null}
      <Button
        size="sm"
        variant="outline"
        onClick={onNewChat}
        disabled={isSending}
        title="New Chat"
        className="border-[1px] border-[color-mix(in_srgb,var(--fill-primary)_16%,transparent)] bg-[color-mix(in_srgb,var(--material-sidepane)_88%,var(--fill-primary)_8%)] px-2 text-[12px] text-[color-mix(in_srgb,var(--fill-primary)_78%,transparent)]"
      >
        <Plus />
      </Button>

      <Button
        size="sm"
        variant="outline"
        onClick={onToggleHistory}
        title="History"
        className="border-[1px] border-[color-mix(in_srgb,var(--fill-primary)_16%,transparent)] bg-[color-mix(in_srgb,var(--material-sidepane)_88%,var(--fill-primary)_8%)] px-2 text-[12px] text-[color-mix(in_srgb,var(--fill-primary)_78%,transparent)]"
      >
        <History />
      </Button>
    </div>
  );
}

interface ContextBadgeProps {
  title: string;
  creators: string;
  year: string;
  keyText?: string;
}

function ContextBadge({ title, creators, year, keyText }: ContextBadgeProps) {
  const tooltip = `${title} / ${creators} / ${year} / ${keyText}`;
  const summary = `${title} | ${creators} | ${year}`;

  return (
    <div
      title={tooltip}
      className="flex items-center gap-1.5 rounded-md border border-[color-mix(in_srgb,var(--fill-primary)_16%,transparent)] bg-[color-mix(in_srgb,var(--material-sidepane)_88%,var(--fill-primary)_7%)] p-2 text-[12px] text-[color-mix(in_srgb,var(--fill-primary)_60%,transparent)]"
    >
      <span className="shrink-0 font-semibold uppercase tracking-wide text-[color-mix(in_srgb,var(--fill-primary)_44%,transparent)]">
        CONTEXT
      </span>
      <span className="line-clamp-1 min-w-0 flex-1">{summary}</span>
    </div>
  );
}

interface ScrollToBottomButtonProps {
  visible: boolean;
  onClick: () => void;
}

export function ScrollToBottomButton({
  visible,
  onClick,
}: ScrollToBottomButtonProps) {
  return (
    <Button
      size="icon"
      onClick={onClick}
      className={cn(
        "sticky bottom-0 right-2 ml-auto rounded-full border-[1px] border-[color-mix(in_srgb,var(--fill-primary)_18%,transparent)] bg-[color-mix(in_srgb,var(--material-sidepane)_72%,var(--fill-primary)_16%)] p-3 text-[color-mix(in_srgb,var(--fill-primary)_84%,transparent)]",
        !visible && "hidden",
      )}
    >
      <ChevronDown />
    </Button>
  );
}

interface SendingIndicatorProps {
  isSending: boolean;
}

export function SendingIndicator({ isSending }: SendingIndicatorProps) {
  if (!isSending) return null;
  return (
    <div className="text-sm text-[color-mix(in_srgb,var(--fill-primary)_60%,transparent)]">
      Answering...
    </div>
  );
}
