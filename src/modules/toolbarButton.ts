import { config } from "../../package.json";
import { isPanelShown, togglePanel } from "./sidebarPanel";

export function registerToolbarButton(): void {
  const doc = Zotero.getMainWindow().document;

  if (doc.getElementById(`${config.addonRef}-toolbar-button`)) {
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
      id: `${config.addonRef}-toolbar-button`,
      attributes: {
        title: "MarginMind",
      },
      styles: {
        backgroundImage: `url(chrome://${config.addonRef}/content/icons/favicon.png)`,
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

  // Register global tab notifier for sidebar sync across tabs
  //   registerGlobalTabNotifier();

  // Initialize guide prefs and show guide if needed
  //   Guide.initPrefs();
  //   setTimeout(() => {
  //     Guide.showToolbarGuideIfNeed(Zotero.getMainWindow());
  //   }, 500);

  ztoolkit.log("Toolbar button registered", button);
}
