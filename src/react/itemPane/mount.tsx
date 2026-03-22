import { createRoot, type Root } from "react-dom/client";
import type { InSituAIReactWindow, ItemPaneRenderPayload } from "../bridge";
import { ItemPaneSection } from "./ItemPaneSection";

const reactWindow = globalThis as unknown as InSituAIReactWindow;
const roots =
  (reactWindow.__insituaiReactRoots as WeakMap<Element, Root> | undefined) ??
  new WeakMap<Element, Root>();
reactWindow.__insituaiReactRoots = roots;

export function mountItemPane({
  container,
  data,
  showSelectedText,
  selectedText,
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
    />,
  );
}
