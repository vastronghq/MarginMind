import type { MarginMindReactWindow, SidebarPanelData } from "../react/bridge";

const PANEL_ID = `marginmind-react-sidebar-panel`;
const PANEL_ROOT_ID = `marginmind-react-sidebar-panel-root`;
const REACT_WINDOW_SCRIPT_URL = `${rootURI}content/scripts/ui.js`;
const REACT_STYLE_URL = `${rootURI}content/styles/ui.css`;
const REACT_ASSET_VERSION =
  __env__ === "development" ? `${Date.now()}` : "production";

type SidebarState = {
  panel: HTMLDivElement;
  root: HTMLDivElement;
  visible: boolean;
  tickerID: number;
  lastKey: string;
};

const windowStates = new WeakMap<Window, SidebarState>();

export function registerSidebarPanel(win: _ZoteroTypes.MainWindow) {
  const existing = windowStates.get(win);
  if (existing) return;

  const state = createSidebarState(win);
  windowStates.set(win, state);
}

export function unregisterSidebarPanel(win: Window) {
  const state = windowStates.get(win);
  if (!state) return;
  win.clearInterval(state.tickerID);
  state.panel.remove();
  windowStates.delete(win);
}

export function unregisterAllSidebarPanels() {
  for (const win of Zotero.getMainWindows()) {
    unregisterSidebarPanel(win);
  }
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
}

export function hidePanel(win: Window = Zotero.getMainWindow()) {
  const state = windowStates.get(win);
  if (!state) return;
  if (!state.visible) return;
  state.visible = false;
  state.panel.style.display = "none";
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
    "top: 52px",
    "right: 10px",
    "width: 360px",
    "height: calc(100vh - 76px)",
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

  const state: SidebarState = {
    panel,
    root,
    visible: false,
    tickerID: win.setInterval(() => {
      const latest = windowStates.get(win);
      if (!latest?.visible) return;
      renderPanel(win, latest);
    }, 900),
    lastKey: "",
  };
  return state;
}

function renderPanel(win: Window, state: SidebarState, force = false) {
  const item = getCurrentItem(win);
  const key = `${item?.id ?? "none"}:${item?.dateModified ?? ""}`;
  if (!force && state.lastKey === key) return;
  state.lastKey = key;

  const reactWin = win as MarginMindReactWindow;
  ensureReactBridge(reactWin);
  reactWin.__marginmindReact?.renderSidebarPanel({
    container: state.root,
    data: item ? serializeItem(item) : null,
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
    title,
    creators: formatCreators(item),
    year,
    itemType: Zotero.ItemTypes.getName(item.itemTypeID) || "item",
    abstractPreview,
  };
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
