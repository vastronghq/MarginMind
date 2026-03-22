import { createRoot, type Root } from "react-dom/client";
import { ItemPaneSection } from "./ItemPaneSection";

type SerializedItemPaneData = {
  title: string;
  creators: string;
  year: string;
  abstractPreview: string;
  keyText: string;
};

type RuntimeWindow = Window & {
  __insituaiItemPaneRoots?: WeakMap<Element, Root>;
  __insituaiRenderItemPane?: (args: {
    container: Element;
    data: SerializedItemPaneData | null;
    showSelectedText: boolean;
    selectedText: string;
  }) => void;
};

const runtimeWindow = globalThis as unknown as RuntimeWindow;
runtimeWindow.__insituaiItemPaneRoots ??= new WeakMap<Element, Root>();

runtimeWindow.__insituaiRenderItemPane = ({
  container,
  data,
  showSelectedText,
  selectedText,
}) => {
  let root = runtimeWindow.__insituaiItemPaneRoots!.get(container);
  if (!root) {
    root = createRoot(container);
    runtimeWindow.__insituaiItemPaneRoots!.set(container, root);
  }

  root.render(
    <ItemPaneSection
      data={data}
      showSelectedText={showSelectedText}
      selectedText={selectedText}
    />,
  );
};
