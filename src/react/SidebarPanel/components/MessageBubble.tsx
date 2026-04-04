import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "../hooks/useChatSession";
import { ROLE_LABEL } from "../utils";
import { renderMarkdown, mdComponents } from "../markdown";
import { CollapsibleDetails } from "./collapsible-details";
import { truncateMiddle } from "../utils";

interface MessageBubbleProps {
  message: ChatMessage;
  isSelectionMode: boolean;
  selectedIDs: string[];
  onToggleSelect: (id: string) => void;
  onContextMenu: (id: string) => void;
  markdownFontSize?: string;
}

export function MessageBubble({
  message,
  isSelectionMode,
  selectedIDs,
  onToggleSelect,
  onContextMenu,
  markdownFontSize = "text-[18px]",
}: MessageBubbleProps) {
  const isSelected = selectedIDs.includes(message.id);

  return (
    <div
      className={cn(
        isSelectionMode ? "cursor-pointer select-none" : "select-text",
      )}
      onContextMenu={(event) => {
        event.preventDefault();
        onContextMenu(message.id);
      }}
      onClick={() => {
        if (!isSelectionMode) return;
        onToggleSelect(message.id);
      }}
    >
      <div
        className={cn(
          "flex",
          message.role === "user" ? "justify-end" : "justify-start",
        )}
      >
        <Card
          className={cn(
            "relative rounded-2xl px-3 py-2",
            markdownFontSize,
            "leading-[1.75]", // 必须写在markdownFontSize后面，不然markdownFontSize的默认行高会覆盖
            message.role === "assistant"
              ? "w-full overflow-hidden border-solid border-[color-mix(in_srgb,var(--fill-primary)_16%,transparent)] bg-[color-mix(in_srgb,var(--material-sidepane)_84%,var(--fill-primary)_8%)] text-[var(--fill-primary)]"
              : "max-w-[80%] border-solid border-[color-mix(in_srgb,var(--accent-blue)_45%,transparent)] bg-[color-mix(in_srgb,var(--accent-blue)_20%,transparent)] text-[var(--fill-primary)]",
            isSelectionMode ? "select-none" : "select-text",
            isSelected &&
              "ring-2 ring-[color-mix(in_srgb,var(--accent-blue)_62%,transparent)]",
          )}
        >
          {isSelectionMode ? (
            <input
              type="checkbox"
              checked={isSelected}
              readOnly
              className="absolute right-2 top-2 h-4 w-4 accent-[var(--accent-blue)]"
            />
          ) : null}
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[color-mix(in_srgb,var(--fill-primary)_48%,transparent)]">
            <span>{ROLE_LABEL[message.role]}</span>
            {message.meta ? (
              <span className="text-[color-mix(in_srgb,var(--fill-primary)_36%,transparent)]">
                {message.meta}
              </span>
            ) : null}
          </div>
          <MessageContent message={message} />
        </Card>
      </div>
    </div>
  );
}

function MessageContent({ message }: { message: ChatMessage }) {
  if (message.role !== "assistant") {
    const contextPart = message.contextText || "";
    const userPart = message.displayText ?? message.text;

    return (
      <div data-render-mode="plain" className="mt-2 whitespace-pre-wrap">
        {contextPart && (
          <CollapsibleDetails
            title="[Context]"
            content={truncateMiddle(contextPart, 2000, 2000)}
            defaultOpen={false}
            components={{
              a: mdComponents?.a,
              pre: mdComponents?.pre,
              code: mdComponents?.code,
              table: mdComponents?.table,
              ul: mdComponents?.ul,
              ol: mdComponents?.ol,
              li: mdComponents?.li,
              thead: mdComponents?.thead,
              th: mdComponents?.th,
              tr: mdComponents?.tr,
              td: mdComponents?.td,
              img: mdComponents?.img,
            }}
          />
        )}
        {userPart && <div>{userPart}</div>}
      </div>
    );
  } else {
    return (
      <div>
        {message.thinking ? (
          <div data-thinking-section className="mt-2">
            <CollapsibleDetails
              title={
                message.thoughtDuration != null
                  ? `Thought for ${message.thoughtDuration} second${message.thoughtDuration === 1 ? "" : "s"}`
                  : "Thinking"
              }
              content={message.thinking}
              defaultOpen={true}
              components={mdComponents}
            />
          </div>
        ) : null}
        <div className="[&>*:first-child]:mt-4 [&>*:last-child]:mb-4">
          {renderMarkdown(message.text)}
        </div>
      </div>
    );
  }
}
