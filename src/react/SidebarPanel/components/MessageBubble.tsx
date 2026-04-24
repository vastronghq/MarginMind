import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { memo } from "react";
import type { ChatMessage } from "../hooks/useChatSession";
import { ROLE_LABEL } from "../utils";
import { MarkdownRenderer, mdComponents } from "./MarkdownRenderer";
import { CollapsibleDetails } from "./CollapsibleDetails";
import { truncateMiddle } from "../utils";
import { Copy, RotateCcw, Trash2 } from "lucide-react";

interface MessageBubbleProps {
  message: ChatMessage;
  isSelectionMode: boolean;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onContextMenu: (id: string) => void;
  markdownFontSize?: string;
  isLatestAssistant?: boolean;
  onCopy?: (id: string) => void;
  onRetry?: (id: string) => void;
  onDeleteMessage?: (id: string) => void;
}

function MessageBubbleInner({
  message,
  isSelectionMode,
  isSelected,
  onToggleSelect,
  onContextMenu,
  markdownFontSize = "text-[14px]",
  isLatestAssistant = false,
  onCopy,
  onRetry,
  onDeleteMessage,
}: MessageBubbleProps) {
  return (
    <div
      contentEditable={true}
      // 夺取控制权。让浏览器认为这是一个输入区域，从而绕过 Zotero 插件主窗体对 Ctrl+C 等快捷键的全局拦截。
      className={cn(
        "group",
        isSelectionMode ? "cursor-pointer select-none" : "select-text",
        "!cursor-default caret-transparent !outline-none",
        // !cursor-default: 还原箭头。在父容器上使用，防止整个区域显示为"文本输入"指针。
        // !outline-none: 消除边框。contentEditable 默认在点击时会出现蓝色或黑色的外框，此项将其隐藏。
        // caret-transparent: 隐藏光标。隐藏编辑模式下那个闪烁的竖线（I-beam），让用户感知不到这是一个"输入框"。
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
          contentEditable={false}
          // 保护内容。在 Markdown 容器上设为 false，确保内容"看起来"像普通网页，用户无法通过键盘删除或修改文字，但保留父级的复制特权。
          className={cn(
            "!cursor-text",
            // !cursor-text: 内容暗示。仅在 Markdown 文本区使用，当鼠标经过时显示"I"型指针，暗示此处可选中。
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
          <div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-[color-mix(in_srgb,var(--fill-primary)_48%,transparent)]">
            <span className="uppercase">{ROLE_LABEL[message.role]}</span>
            {message.meta ? (
              <span className="text-[color-mix(in_srgb,var(--fill-primary)_36%,transparent)]">
                {message.meta}
              </span>
            ) : null}
          </div>
          <MessageContent message={message} />
        </Card>
      </div>
      {!isSelectionMode ? (
        <div
          contentEditable={false}
          className={cn(
            "flex items-center gap-0.5",
            "mt-2",
            "opacity-0 transition-opacity duration-150 group-hover:opacity-100",
            message.role === "user" ? "mr-1 justify-end" : "ml-1 justify-start",
          )}
        >
          <ActionButton
            icon={<Copy size={14} />}
            tooltip="Copy"
            onClick={(e) => {
              e.stopPropagation();
              onCopy?.(message.id);
            }}
          />
          {isLatestAssistant ? (
            <ActionButton
              icon={<RotateCcw size={14} />}
              tooltip="Retry"
              onClick={(e) => {
                e.stopPropagation();
                onRetry?.(message.id);
              }}
            />
          ) : null}
          <ActionButton
            icon={<Trash2 size={14} />}
            tooltip="Delete"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteMessage?.(message.id);
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

export const MessageBubble = memo(
  MessageBubbleInner,
  (prev, next) =>
    prev.message === next.message &&
    prev.isSelectionMode === next.isSelectionMode &&
    prev.isSelected === next.isSelected &&
    prev.onToggleSelect === next.onToggleSelect &&
    prev.onContextMenu === next.onContextMenu &&
    prev.markdownFontSize === next.markdownFontSize &&
    prev.isLatestAssistant === next.isLatestAssistant &&
    prev.onCopy === next.onCopy &&
    prev.onRetry === next.onRetry &&
    prev.onDeleteMessage === next.onDeleteMessage,
);

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
          <MarkdownRenderer content={message.text} />
        </div>
      </div>
    );
  }
}

function ActionButton({
  icon,
  tooltip,
  onClick,
}: {
  icon: React.ReactNode;
  tooltip: string;
  onClick: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      title={tooltip}
      onClick={onClick}
      className="inline-flex items-center justify-center rounded-md p-1 text-[color-mix(in_srgb,var(--fill-primary)_36%,transparent)] transition-colors hover:bg-[color-mix(in_srgb,var(--fill-primary)_10%,transparent)] hover:text-[var(--fill-primary)]"
    >
      {icon}
    </button>
  );
}
