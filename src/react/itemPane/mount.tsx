import { createRoot, type Root } from "react-dom/client";
import type { MarginMindReactWindow, ItemPaneRenderPayload } from "../bridge";
import { ItemPaneSection } from "./ItemPaneSection";

const reactWindow = globalThis as unknown as MarginMindReactWindow;
const roots =
  (reactWindow.__marginmindReactRoots as WeakMap<Element, Root> | undefined) ??
  new WeakMap<Element, Root>();
reactWindow.__marginmindReactRoots = roots;

export function mountItemPane({
  container,
  data,
  showSelectedText,
  selectedText,
  selectedAnnotation,
}: ItemPaneRenderPayload) {
  let root = roots.get(container);
  if (!root) {
    root = createRoot(container);
    roots.set(container, root);
  }

  root.render(
    <ItemPaneSection
      data={data}
      showSelectedText={showSelectedText}
      selectedText={selectedText}
      selectedAnnotation={selectedAnnotation}
    />,
  );
}
