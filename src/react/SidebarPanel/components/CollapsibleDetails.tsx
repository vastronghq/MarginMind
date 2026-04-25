import Markdown from "react-markdown";
import {
  MARKDOWN_REHYPE_PLUGINS,
  MARKDOWN_REMARK_PLUGINS,
} from "./MarkdownRenderer";

interface DetailsProps {
  /** 标题内容 */
  title: React.ReactNode;
  /** 内容区域的 Markdown 文本 */
  content: string;
  /** 是否默认展开，默认 false */
  isOpen?: boolean;
  /** Markdown 组件配置（可选，允许外部覆盖） */
  components?: React.ComponentProps<typeof Markdown>["components"];
}

export function CollapsibleDetails({
  title,
  content,
  isOpen = false,
  components,
}: DetailsProps) {
  return (
    <details className="mb-2" open={isOpen}>
      <summary className="cursor-pointer select-none text-[12px] font-medium tracking-wide text-[color-mix(in_srgb,var(--fill-primary)_42%,transparent)] hover:text-[color-mix(in_srgb,var(--fill-primary)_60%,transparent)]">
        {title}
      </summary>
      <div className="mt-1 border-y-0 border-l-2 border-r-0 border-solid border-[color-mix(in_srgb,var(--fill-primary)_14%,transparent)] pl-3 text-[14px] leading-[24px] text-[color-mix(in_srgb,var(--fill-primary)_52%,transparent)] [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
        <Markdown
          remarkPlugins={MARKDOWN_REMARK_PLUGINS}
          rehypePlugins={MARKDOWN_REHYPE_PLUGINS}
          urlTransform={(uri) => (uri.startsWith("zotero://") ? uri : uri)}
          components={components}
        >
          {content}
        </Markdown>
      </div>
    </details>
  );
}
