import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import { cn } from "@/lib/utils";

export const MARKDOWN_REMARK_PLUGINS = [remarkGfm, remarkMath];
export const MARKDOWN_REHYPE_PLUGINS = [rehypeKatex, rehypeHighlight];

export const mdComponents: React.ComponentProps<typeof Markdown>["components"] =
  {
    a: ({ href, ...props }) => (
      <a
        {...props}
        rel="noopener noreferrer"
        onClick={(e) => {
          e.preventDefault();
          if (!href) return;
          if (href.startsWith("zotero://")) {
            handleInternalJump(href);
          } else {
            Zotero.launchURL(href);
          }
        }}
      />
    ),
    pre: ({ ...props }) => (
      <pre
        {...props}
        className={cn(
          "overflow-x-auto rounded-md bg-[color-mix(in_srgb,var(--fill-primary)_6%,transparent)] p-2 text-[0.85em]",
          props.className,
        )}
      />
    ),
    code: ({ children, className, ...props }) => {
      const isBlock = className?.includes("language-");

      return (
        <code
          {...props}
          className={cn(
            "font-mono",
            isBlock
              ? "block"
              : "rounded bg-[color-mix(in_srgb,var(--fill-primary)_8%,transparent)] px-[0.3em] py-[0.1em] before:content-[''] after:content-['']",
            className,
          )}
        >
          {children}
        </code>
      );
    },

    ul: ({ ...props }) => (
      <ul
        {...props}
        className={cn("pl-10 [&_ol]:pl-6 [&_ul]:pl-6", props.className)}
      />
    ),
    ol: ({ ...props }) => (
      <ol
        {...props}
        className={cn("pl-10 [&_ol]:pl-6 [&_ul]:pl-6", props.className)}
      />
    ),
    li: ({ ...props }) => <li {...props} className={cn("", props.className)} />,

    blockquote: ({ ...props }) => (
      <blockquote
        {...props}
        className={cn(
          "mx-5 my-2 border-y-0 border-l-8 border-r-0 border-solid border-[color-mix(in_srgb,var(--accent-blue)_50%,transparent)] bg-[color-mix(in_srgb,var(--accent-blue)_8%,transparent)] px-2 py-1 text-[color-mix(in_srgb,var(--fill-primary)_80%,transparent)]",
          props.className,
        )}
      />
    ),
    table: ({ ...props }) => (
      <div className="my-2 overflow-x-auto">
        <table
          {...props}
          className={cn(
            "w-full border-collapse border border-[color-mix(in_srgb,var(--fill-primary)_20%,transparent)] text-[0.85em]",
            props.className,
          )}
        />
      </div>
    ),
    thead: ({ ...props }) => (
      <thead
        {...props}
        className={cn(
          "bg-[color-mix(in_srgb,var(--fill-primary)_6%,transparent)]",
          props.className,
        )}
      />
    ),
    th: ({ ...props }) => (
      <th
        {...props}
        className={cn(
          "border border-[color-mix(in_srgb,var(--fill-primary)_20%,transparent)] px-2 py-1.5 text-left font-semibold text-[color-mix(in_srgb,var(--fill-primary)_88%,transparent)]",
          props.className,
        )}
      />
    ),
    td: ({ ...props }) => (
      <td
        {...props}
        className={cn(
          "border border-[color-mix(in_srgb,var(--fill-primary)_20%,transparent)] px-2 py-1.5",
          props.className,
        )}
      />
    ),
    h1: ({ ...props }) => (
      <h1
        {...props}
        className={cn(
          "mb-4 mt-8 text-[1.8em] font-extrabold tracking-tight",
          props.className,
        )}
      />
    ),
    h2: ({ ...props }) => (
      <h2
        {...props}
        className={cn(
          "mb-3 mt-6 text-[1.6em] font-bold tracking-tight",
          props.className,
        )}
      />
    ),
    h3: ({ ...props }) => (
      <h3
        {...props}
        className={cn("mb-3 mt-5 text-[1.4em] font-bold", props.className)}
      />
    ),
    h4: ({ ...props }) => (
      <h4
        {...props}
        className={cn("mb-2 mt-4 text-[1.2em] font-semibold", props.className)}
      />
    ),
    h5: ({ ...props }) => (
      <h5
        {...props}
        className={cn("mb-2 mt-3 text-[1.1em] font-semibold", props.className)}
      />
    ),
    h6: ({ ...props }) => (
      <h6
        {...props}
        className={cn("mb-1 mt-2 text-[1em] font-bold", props.className)}
      />
    ),
    img: ({ ...props }) => (
      <img
        {...props}
        className={cn("my-2 max-w-full rounded", props.className)}
      />
    ),
  };

const handleInternalJump = async (href: string) => {
  if (!href || !href.startsWith("zotero://")) return;

  try {
    console.log("handleInternalJump", href);
    const url = new URL(href);
    const itemKey = url.pathname.split("/").pop();
    const pageStr = url.searchParams.get("page");
    const regionStr = url.searchParams.get("region");

    const regionArr: Array<number[]> = JSON.parse(
      decodeURIComponent(regionStr as string) ?? "[]",
    );
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const annotationKey = url.searchParams.get("annotation");

    const item: any = Zotero.Items.getByLibraryAndKey(
      Zotero.Libraries.userLibraryID,
      itemKey as string,
    );

    if (!item) throw new Error(`Item not found: ${itemKey}`);

    const pageIndex = pageStr ? parseInt(pageStr, 10) - 1 : 0;
    const location: _ZoteroTypes.Reader.Location = {
      position: { rects: regionArr, pageIndex: pageIndex },
    };

    const reader = await Zotero.Reader.open(item.id, location);
    reader?.navigate(location);
  } catch (err) {
    console.log("Internal jump failed, falling back to launchURL", err);
    Zotero.launchURL(href);
  }
};

interface MarkdownRendererProps {
  content: string;
}

export const MarkdownRenderer = ({ content }: MarkdownRendererProps) => (
  <Markdown
    remarkPlugins={MARKDOWN_REMARK_PLUGINS}
    rehypePlugins={MARKDOWN_REHYPE_PLUGINS}
    urlTransform={(uri) => (uri.startsWith("zotero://") ? uri : uri)}
    components={mdComponents}
  >
    {content}
  </Markdown>
);
