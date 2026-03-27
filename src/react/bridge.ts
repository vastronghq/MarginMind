export type ItemPaneData = {
  itemID: number | null;
  attachmentItemID: number | null;
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
  selectedAnnotation: _ZoteroTypes.Annotations.AnnotationJson | null;
};

export type PreferencesRenderPayload = {
  container: Element;
};

export type SidebarPanelData = {
  itemID: number | null;
  title: string;
  creators: string;
  year: string;
  itemType: string;
  abstractPreview: string;
};

export type SidebarPanelRenderPayload = {
  container: Element;
  data: SidebarPanelData | null;
};

export type MarginMindReactBridge = {
  renderItemPane(payload: ItemPaneRenderPayload): void;
  renderPreferences(payload: PreferencesRenderPayload): void;
  renderSidebarPanel(payload: SidebarPanelRenderPayload): void;
};

export type MarginMindReactWindow = Window & {
  __marginmindReact?: MarginMindReactBridge;
  __marginmindReactLoaded?: boolean;
  __marginmindReactRoots?: WeakMap<Element, unknown>;
  __marginmindReactStyleURL?: string;
  __marginmindReactAssetVersion?: string;
};
