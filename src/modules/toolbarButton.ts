import { config } from "../../package.json";
import { isPanelShown, togglePanel } from "./sidebarPanel";

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
            togglePanel(win);
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
