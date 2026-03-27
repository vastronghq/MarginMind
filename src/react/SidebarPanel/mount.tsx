import { createRoot, type Root } from "react-dom/client";
import type {
  MarginMindReactWindow,
  SidebarPanelRenderPayload,
} from "../bridge";
import { SidebarPanel } from "./SidebarPanel";

const reactWindow = globalThis as unknown as MarginMindReactWindow;
const roots =
  (reactWindow.__marginmindReactRoots as WeakMap<Element, Root> | undefined) ??
  new WeakMap<Element, Root>();
reactWindow.__marginmindReactRoots = roots;

export function mountSidebarPanel({
  container,
  data,
  showSelectedText,
  selectedText,
  selectedAnnotation,
}: SidebarPanelRenderPayload) {
  let root = roots.get(container);
  if (!root) {
    root = createRoot(container);
    roots.set(container, root);
  }

  root.render(
    <SidebarPanel
      data={data}
      showSelectedText={showSelectedText}
      selectedText={selectedText}
      selectedAnnotation={selectedAnnotation}
    />,
  );
}
