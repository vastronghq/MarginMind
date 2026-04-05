import { cn } from "@/lib/utils";
import {
  FileText,
  Loader2,
  AlertCircle,
  FileSearch,
  LucideIcon,
} from "lucide-react";

interface MarkdownStatusConfig {
  label: (progress?: string) => string;
  colorClass: string;
  icon: LucideIcon;
  title: (progress: string) => string;
  animate?: boolean;
  isSpinning?: boolean;
  isPulsing?: boolean;
}

const MARKDOWN_STATUS_CONFIG: Record<string, MarkdownStatusConfig> = {
  cached: {
    label: () => "Full Text",
    colorClass: "bg-green-500",
    icon: FileText,
    title: () =>
      "Full text ready. To re-parse, clear the cache (Settings > MarginMind > MinerU Configuration).",
  },
  parsing: {
    label: (progress) => progress || "Parsing...",
    colorClass: "bg-yellow-500",
    icon: Loader2,
    title: (progress) => progress || "Parsing...",
    isSpinning: true, // 只有它需要旋转
    isPulsing: true, // 圆点呼吸
  },
  error: {
    label: () => "Error",
    colorClass: "bg-red-500",
    icon: AlertCircle,
    title: (progress) =>
      `${progress || "Parse failed"} (Something went wrong. Please check and try again.)`,
  },
  default: {
    label: () => "Metadata",
    colorClass: "bg-gray-400",
    icon: FileSearch,
    title: () => "Only metadata available. Click to parse the full document.",
  },
};

export function MarkdownStatusBadge({
  config,
  progress,
}: {
  config: MarkdownStatusConfig;
  progress?: string;
}) {
  // 获取当前状态配置，若无则回退到 default
  const Icon = config.icon;

  return (
    <div className="flex items-center gap-1 p-1">
      {/* 状态小圆点 */}
      <div
        className={cn(
          "h-2 w-2 rounded-full",
          config.colorClass,
          config.isPulsing && "animate-pulse",
        )}
      />

      {/* Lucide 图标 */}
      <Icon
        size={14}
        className={cn(
          "text-muted-foreground",
          config.isSpinning && "animate-spin",
        )}
      />

      {/* 状态文案 */}
      <span>{config.label(progress)}</span>
    </div>
  );
}

export function MarkdownParseButton({
  status,
  onClick,
  parseProgress,
}: {
  status: string;
  onClick: () => void;
  parseProgress: string;
}) {
  const config =
    MARKDOWN_STATUS_CONFIG[status] || MARKDOWN_STATUS_CONFIG.default;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation(); // 阻止冒泡，防止触发外层 Item 的点击
        onClick();
      }}
      disabled={status === "parsing"}
      title={config.title(parseProgress)} // 逻辑被配置化了
      className="inline-flex shrink-0 items-center gap-1 rounded p-0.5 text-[11px] transition hover:bg-[color-mix(in_srgb,var(--fill-primary)_10%,transparent)]"
    >
      {/* 现在的 Badge 只需要负责内部的圆点、图标和文字 */}
      <MarkdownStatusBadge config={config} progress={parseProgress} />
    </button>
  );
}
