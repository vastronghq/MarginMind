export type ItemPaneData = {
  title: string;
  creators: string;
  year: string;
  abstractPreview: string;
  keyText: string;
};

export type ItemPaneRenderPayload = {
  container: Element;
  data: ItemPaneData | null;
  showSelectedText: boolean;
  selectedText: string;
};

export type InSituAIReactBridge = {
  renderItemPane(payload: ItemPaneRenderPayload): void;
};

export type InSituAIReactWindow = Window & {
  __insituaiReact?: InSituAIReactBridge;
  __insituaiReactLoaded?: boolean;
  __insituaiReactRoots?: WeakMap<Element, unknown>;
};
