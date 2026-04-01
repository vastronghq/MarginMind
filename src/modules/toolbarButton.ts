import { config } from "../../package.json";
import { isPanelShown, showPanel, hidePanel } from "./sidebarPanel";

const TOOLBAR_BUTTON_ID = `${config.addonRef}-toolbar-button`;

export function registerToolbarButton(): void {
  const doc = Zotero.getMainWindow().document;

  if (doc.getElementById(TOOLBAR_BUTTON_ID)) {
    ztoolkit.log("Toolbar button already exists");
    return;
  }

  const anchor = doc.querySelector(
    "#zotero-tabs-toolbar > .zotero-tb-separator",
  );
  if (!anchor) {
    ztoolkit.log("Tabs toolbar separator not found");
    return;
  }

  const button = ztoolkit.UI.insertElementBefore(
    {
      tag: "div",
      namespace: "html",
      id: TOOLBAR_BUTTON_ID,
      attributes: {
        title: "MarginMind",
      },
      styles: {
        backgroundImage: `url(chrome://${config.addonRef}/content/icons/icon.svg)`,
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center",
        backgroundSize: "18px",
        display: "flex",
        width: "28px",
        height: "28px",
        alignItems: "center",
        borderRadius: "5px",
        cursor: "pointer",
      },
      listeners: [
        {
          type: "click",
          listener: () => {
            const win = Zotero.getMainWindow();
            if (isPanelShown(win)) {
              // 反转逻辑：仅关闭面板，保持侧边栏状态
              hidePanel(win);
            } else {
              // 激活逻辑：显示面板并强制打开侧边栏
              showPanel(win);
              forceOpenSidebar(win);
            }
          },
        },
        {
          type: "mouseover",
          listener: (e: Event) => {
            (e.currentTarget as HTMLElement).style.backgroundColor =
              "var(--fill-quinary)";
          },
        },
        {
          type: "mouseout",
          listener: (e: Event) => {
            if (!isPanelShown(Zotero.getMainWindow())) {
              (e.currentTarget as HTMLElement).style.backgroundColor =
                "transparent";
            }
          },
        },
      ],
    },
    anchor.nextElementSibling as Element,
  ) as HTMLElement;

  ztoolkit.log("444444444444444444444444444");
  for (const sidenav of [
    doc.getElementById("zotero-view-item-sidenav"),
    doc.getElementById("zotero-context-pane-sidenav"),
  ]) {
    if (!sidenav) continue;
    // ztoolkit.log("sidenav", sidenav);
    sidenav.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;
      //   // ztoolkit.log("target", target);
      const btn = target.closest(".btn");
      //   // ztoolkit.log("btn", btn);
      if (!btn) return;
      const win = Zotero.getMainWindow();
      if (!isPanelShown(win)) return;
      // // toggle-pane → 关闭插件面板，让原生 handler 继续关闭侧边栏
      // if ((btn as HTMLElement).dataset.action === "toggle-pane") {
      //   hidePanel(win);
      //   return;
      // }
      // // 其他功能按钮 → 关闭插件面板，释放空间
      hidePanel(win);
    });
  }

  ztoolkit.log("Toolbar button registered", button);
}

export function unregisterToolbarButton(): void {
  const doc = Zotero.getMainWindow()?.document;
  if (!doc) return;

  const button = doc.getElementById(TOOLBAR_BUTTON_ID);
  if (button) {
    button.remove();
    ztoolkit.log("Toolbar button unregistered");
  }
}

/**
 * 强制打开Zotero侧边栏
 * 根据当前界面类型（Library/Reader）找到对应的侧边栏按钮并点击
 */
function forceOpenSidebar(win: Window): void {
  const doc = win.document;
  const selectedType = (win as { Zotero_Tabs?: { selectedType?: string } })
    .Zotero_Tabs?.selectedType;
  ztoolkit.log("forceOpenSidebar", selectedType);

  // 根据当前界面类型，找到对应的侧边栏切换按钮
  let toggleButton: HTMLElement | null = null;
  if (selectedType === "reader") {
    toggleButton = doc.querySelector('[data-l10n-id="toggle-context-pane"]');
  } else if (selectedType === "library") {
    toggleButton = doc.querySelector('[data-l10n-id="toggle-item-pane"]');
  }

  if (!toggleButton) {
    ztoolkit.log("Sidebar toggle button not found");
    return;
  }
  ztoolkit.log("toggleButton", toggleButton);

  // 检查侧边栏是否已经打开
  if (!isSidebarVisible(win)) {
    // 点击按钮打开侧边栏
    toggleButton.click();
    ztoolkit.log("Forced sidebar open");
  }
}

/**
 * 检测侧边栏是否可见
 */
function isSidebarVisible(win: Window): boolean {
  const doc = win.document;
  const selectedType = (win as { Zotero_Tabs?: { selectedType?: string } })
    .Zotero_Tabs?.selectedType;

  let targetId = "";
  if (selectedType === "reader") {
    targetId = "splitter#zotero-context-splitter";
  } else if (selectedType === "library") {
    targetId = "splitter#zotero-items-splitter";
  }

  const target = doc.querySelector(targetId);
  ztoolkit.log("isSidebarVisible", target);
  if (!target) return false;

  // // 检查spliter中的状态值
  const state = target.getAttribute("state");
  ztoolkit.log("isSidebarVisible", state);
  if (state === "collapsed") {
    return false;
  } else {
    return true;
  }
}
