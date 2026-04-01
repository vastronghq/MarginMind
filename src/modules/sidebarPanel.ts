import type { MarginMindReactWindow, SidebarPanelData } from "../react/bridge";
import { config } from "../../package.json";

const PANEL_ID = `${config.addonRef}-react-sidebar-panel`;
const PANEL_ROOT_ID = `${config.addonRef}-react-sidebar-panel-root`;
const SIDEBAR_READER_SELECTION_LISTENER_ID = `${config.addonRef}-sidebar-reader-selection`;
const REACT_WINDOW_SCRIPT_URL = `${rootURI}content/scripts/ui.js`;
const REACT_STYLE_URL = `${rootURI}content/styles/ui.css`;
const REACT_ASSET_VERSION =
  __env__ === "development" ? `${Date.now()}` : "production";

type SidebarState = {
  panel: HTMLDivElement;
  root: HTMLDivElement;
  visible: boolean;
  tickerID: number;
  widthSyncID: number;
  resizeHandler: () => void;
  lastKey: string;
  sidebarObservers: MutationObserver[];
};

const windowStates = new WeakMap<Window, SidebarState>();
let latestReaderSelectionText = "";
let latestReaderSelectionAnnotation: _ZoteroTypes.Annotations.AnnotationJson | null =
  null;
let sidebarReaderSelectionListenerRegistered = false;

export function registerSidebarPanel(win: _ZoteroTypes.MainWindow) {
  const existing = windowStates.get(win);
  if (existing) return;

  const state = createSidebarState(win);
  windowStates.set(win, state);
  registerSidebarReaderSelectionListener();
}

export function unregisterSidebarPanel(win: Window) {
  const state = windowStates.get(win);
  if (!state) return;
  win.clearInterval(state.tickerID);
  win.clearInterval(state.widthSyncID);
  state.sidebarObservers.forEach((obs) => obs.disconnect());
  win.removeEventListener("resize", state.resizeHandler);
  state.panel.remove();
  windowStates.delete(win);
}

export function unregisterAllSidebarPanels() {
  for (const win of Zotero.getMainWindows()) {
    unregisterSidebarPanel(win);
  }
  unregisterSidebarReaderSelectionListener();
}

export function isPanelShown(win: Window = Zotero.getMainWindow()) {
  return !!windowStates.get(win)?.visible;
}

export function showPanel(win: Window = Zotero.getMainWindow()) {
  const state = windowStates.get(win);
  if (!state) return;
  if (state.visible) return;
  state.visible = true;
  state.panel.style.display = "block";
  renderPanel(win, state, true);

  // 面板显示时，绑定侧边栏状态监听
  if (state.sidebarObservers.length === 0) {
    state.sidebarObservers = bindSidebarObservers(win);
  }
}

export function hidePanel(win: Window = Zotero.getMainWindow()) {
  const state = windowStates.get(win);
  if (!state) return;
  if (!state.visible) return;
  state.visible = false;
  state.panel.style.display = "none";

  // 面板隐藏时，断开侧边栏状态监听
  state.sidebarObservers.forEach((obs) => obs.disconnect());
  state.sidebarObservers = [];
}

export function togglePanel(win: Window = Zotero.getMainWindow()) {
  if (isPanelShown(win)) {
    hidePanel(win);
  } else {
    showPanel(win);
  }
}

function createSidebarState(win: Window): SidebarState {
  const doc = win.document;
  const panel = doc.createElementNS(
    "http://www.w3.org/1999/xhtml",
    "div",
  ) as HTMLDivElement;
  panel.id = PANEL_ID;
  panel.style.cssText = [
    "position: fixed",
    "top: 71px",
    "right: 37px",
    // "width: 660px",
    "height: calc(100vh - 71px)",
    "min-height: 320px",
    "z-index: 9999",
    "display: none",
    "overflow: hidden",
    "border-radius: 10px",
    "box-shadow: 0 12px 36px rgba(0,0,0,0.2)",
    "border: 1px solid color-mix(in srgb, var(--fill-primary) 14%, transparent)",
    "background: var(--material-sidepane)",
  ].join(";");

  const root = doc.createElementNS(
    "http://www.w3.org/1999/xhtml",
    "div",
  ) as HTMLDivElement;
  root.id = PANEL_ROOT_ID;
  root.style.cssText = "width:100%;height:100%;";
  panel.appendChild(root);
  doc.documentElement?.appendChild(panel);
  syncPanelWidth(panel, doc, win);

  const resizeHandler = () => syncPanelWidth(panel, doc, win);
  win.addEventListener("resize", resizeHandler);

  const state: SidebarState = {
    panel,
    root,
    visible: false,
    tickerID: win.setInterval(() => {
      const latest = windowStates.get(win);
      if (!latest?.visible) return;
      renderPanel(win, latest);
    }, 900),
    widthSyncID: win.setInterval(() => syncPanelWidth(panel, doc, win), 450),
    resizeHandler,
    lastKey: "",
    sidebarObservers: [],
  };
  return state;
}

function syncPanelWidth(panel: HTMLDivElement, doc: Document, win: Window) {
  const selectedType = win.Zotero_Tabs?.selectedType;
  let targetId = "";
  if (selectedType === "reader") {
    targetId = "zotero-context-pane-inner";
  } else if (selectedType === "library") {
    targetId = "zotero-item-pane-content";
  }
  if (!targetId) return;

  const container = doc.getElementById(targetId) as HTMLElement | null;
  if (container && container.clientWidth > 0) {
    // ztoolkit.log("syncPanelWidth", container.clientWidth);
    // 4px 是为了给拖拽把手留出空间，防止溢出
    panel.style.width = `${container.clientWidth - 4}px`;
  }
}

function renderPanel(win: Window, state: SidebarState, force = false) {
  const item = getCurrentItem(win);
  const key = `${item?.id ?? "none"}:${item?.dateModified ?? ""}:${latestReaderSelectionText}`;
  if (!force && state.lastKey === key) return;
  state.lastKey = key;

  const reactWin = win as MarginMindReactWindow;
  ensureReactBridge(reactWin);
  reactWin.__marginmindReact?.renderSidebarPanel({
    container: state.root,
    data: item ? serializeItem(item) : null,
    showSelectedText: isReaderTabActive(win),
    selectedText: latestReaderSelectionText,
    selectedAnnotation: isReaderTabActive(win)
      ? latestReaderSelectionAnnotation
      : null,
  });
}

function ensureReactBridge(win: MarginMindReactWindow) {
  if (
    win.__marginmindReactLoaded &&
    win.__marginmindReact &&
    win.__marginmindReactAssetVersion === REACT_ASSET_VERSION
  ) {
    return;
  }

  const suffix = __env__ === "development" ? `?t=${REACT_ASSET_VERSION}` : "";
  win.__marginmindReactStyleURL = `${REACT_STYLE_URL}${suffix}`;
  Services.scriptloader.loadSubScript(
    `${REACT_WINDOW_SCRIPT_URL}${suffix}`,
    win,
  );
  win.__marginmindReactLoaded = true;
  win.__marginmindReactAssetVersion = REACT_ASSET_VERSION;
}

function getCurrentItem(win: Window) {
  const pane = (win as { ZoteroPane?: _ZoteroTypes.ZoteroPane }).ZoteroPane;
  const selected = pane?.getSelectedItems?.();
  return (selected?.[0] as Zotero.Item | undefined) ?? undefined;
}

function serializeItem(item: Zotero.Item): SidebarPanelData {
  const title = String(item.getField("title") || "(Untitled)");
  const date = String(item.getField("date") || "");
  const year = date.match(/\d{4}/)?.[0] || "Unknown";
  const abstractText = String(item.getField("abstractNote") || "")
    .replace(/\s+/g, " ")
    .trim();
  const abstractPreview =
    abstractText.length > 220
      ? `${abstractText.slice(0, 220)}...`
      : abstractText || "No abstract";

  return {
    itemID: item.id ?? null,
    attachmentItemID: resolveAttachmentItemID(item),
    title,
    creators: formatCreators(item),
    year,
    keyText: `${item.key} (ID: ${item.id ?? "-"})`,
    itemType: Zotero.ItemTypes.getName(item.itemTypeID) || "item",
    abstractPreview,
  };
}

function resolveAttachmentItemID(item: Zotero.Item) {
  if (item.isAttachment() && item.isPDFAttachment()) {
    return item.id ?? null;
  }

  const attachmentIDs = item.getAttachments();
  for (const attachmentID of attachmentIDs) {
    const attachment = Zotero.Items.get(attachmentID) as
      | Zotero.Item
      | undefined;
    if (attachment?.isAttachment() && attachment.isPDFAttachment()) {
      return attachment.id ?? null;
    }
  }
  return null;
}

function formatCreators(item: Zotero.Item) {
  const creators = item
    .getCreators()
    .map((creator: { name?: string; firstName?: string; lastName?: string }) =>
      creator.name
        ? creator.name
        : [creator.lastName, creator.firstName].filter(Boolean).join(", "),
    )
    .filter(Boolean);
  return creators.length ? creators.join("; ") : "Unknown";
}

function isReaderTabActive(win: Window) {
  const tabs = (win as { Zotero_Tabs?: _ZoteroTypes.Zotero_Tabs }).Zotero_Tabs;
  return tabs?.selectedType === "reader";
}

const sidebarReaderSelectionHandler: _ZoteroTypes.Reader.EventHandler<
  "renderTextSelectionPopup"
> = (event) => {
  const annotation = event.params.annotation;
  const text = annotation.text?.trim();
  if (!text) return;
  const page = annotation.position.pageIndex + 1;
  latestReaderSelectionText = `${text} (page ${page})`;
  latestReaderSelectionAnnotation = annotation;

  for (const win of Zotero.getMainWindows()) {
    const state = windowStates.get(win);
    if (!state?.visible) continue;
    renderPanel(win, state, true);
  }
};

function registerSidebarReaderSelectionListener() {
  if (sidebarReaderSelectionListenerRegistered) return;
  try {
    Zotero.Reader.unregisterEventListener(
      "renderTextSelectionPopup",
      sidebarReaderSelectionHandler,
    );
  } catch (_error) {}

  Zotero.Reader.registerEventListener(
    "renderTextSelectionPopup",
    sidebarReaderSelectionHandler,
    SIDEBAR_READER_SELECTION_LISTENER_ID,
  );
  sidebarReaderSelectionListenerRegistered = true;
}

function unregisterSidebarReaderSelectionListener() {
  if (!sidebarReaderSelectionListenerRegistered) return;
  try {
    Zotero.Reader.unregisterEventListener(
      "renderTextSelectionPopup",
      sidebarReaderSelectionHandler,
    );
  } catch (_error) {}
  sidebarReaderSelectionListenerRegistered = false;
}

/**
 * 绑定 MutationObserver 监听侧边栏 splitter 的 state 属性变化
 * 在面板显示时调用，此时 splitter 元素一定存在
 */
function bindSidebarObservers(win: Window): MutationObserver[] {
  const doc = win.document;
  const splitterIds = ["zotero-items-splitter", "zotero-context-splitter"];
  const observers: MutationObserver[] = [];

  for (const splitterId of splitterIds) {
    const splitter = doc.getElementById(splitterId);
    if (!splitter) continue;

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (
          mutation.type === "attributes" &&
          mutation.attributeName === "state"
        ) {
          const currentState = splitter.getAttribute("state");
          if (currentState === "collapsed") {
            const state = windowStates.get(win);
            if (state?.visible) {
              state.visible = false;
              state.panel.style.display = "none";
              ztoolkit.log("Auto-hid panel: sidebar collapsed");
            }
          }
        }
      }
    });

    observer.observe(splitter, {
      attributes: true,
      attributeFilter: ["state"],
    });

    observers.push(observer);
  }

  return observers;
}
