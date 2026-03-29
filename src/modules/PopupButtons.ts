import { config } from "../../package.json";

const GROUP_ID = `${config.addonRef}-text-selection-popup-btn-group`;
const LISTENER_ID = `${config.addonRef}-text-selection-popup-listener`;
let listenerRegistered = false;

const observedDocs = new Set<Document>();
const observers: MutationObserver[] = [];

function createButtonGroup(doc: Document): HTMLElement {
  const group = doc.createElement("div");
  group.id = GROUP_ID;
  group.className = "tool-toggle";
  // group.style.width = "100%";
  // group.style.height = "100%";
  // group.style.padding = "0 8px";

  const btn1 = doc.createElement("button");
  btn1.tabIndex = -1;
  btn1.title = "button 1";
  btn1.innerHTML = `
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-brain-icon lucide-brain"><path d="M12 18V5"/><path d="M15 13a4.17 4.17 0 0 1-3-4 4.17 4.17 0 0 1-3 4"/><path d="M17.598 6.5A3 3 0 1 0 12 5a3 3 0 1 0-5.598 1.5"/><path d="M17.997 5.125a4 4 0 0 1 2.526 5.77"/><path d="M18 18a4 4 0 0 0 2-7.464"/><path d="M19.967 17.483A4 4 0 1 1 12 18a4 4 0 1 1-7.967-.517"/><path d="M6 18a4 4 0 0 1-2-7.464"/><path d="M6.003 5.125a4 4 0 0 0-2.526 5.77"/></svg>Send
  `;
  btn1.className = "highlight";
  btn1.style.border = "1px solid var(--fill-primary)";
  btn1.style.height = "22px";
  btn1.style.cursor = "pointer";
  // btn1.addEventListener("click", () => handleCopy(group));
  btn1.addEventListener("click", () => ztoolkit.log("copy clicked"));

  const btn2 = doc.createElement("button");
  btn2.tabIndex = -1;
  btn2.title = "button 2";
  btn2.innerHTML = `
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-send-icon lucide-send"><path d="M14.536 21.686a.5.5 0 0 0 .937-.016l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.016.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"/><path d="m21.854 2.147-10.94 10.939"/></svg>
  `;
  btn2.className = "underline";
  btn2.style.border = "1px solid var(--fill-primary)";
  btn2.style.height = "22px";
  btn1.style.cursor = "pointer";
  btn2.addEventListener("click", () => ztoolkit.log("annotate clicked"));

  group.appendChild(btn1);
  group.appendChild(btn2);
  return group;
}

// function handleCopy(group: HTMLElement): void {
//   const popup = group.closest(".view-popup") as HTMLElement | null;
//   if (!popup) return;

//   const win = popup.ownerDocument?.defaultView;
//   if (!win) return;

//   const reader = (win as any).Zotero?.Reader?.getByWindow?.(win);
//   if (!reader) return;

//   const selection = reader._lastSelection;
//   const text = selection?.text;
//   if (!text) return;

//   win.navigator.clipboard.writeText(text).then(() => {
//     const btn = group.querySelector(
//       "button:first-child",
//     ) as HTMLButtonElement | null;
//     if (btn) {
//       btn.classList.add("active");
//       setTimeout(() => btn.classList.remove("active"), 800);
//     }
//   });
// }

// function handleAnnotate(group: HTMLElement): void {
//   const popup = group.closest(".view-popup") as HTMLElement | null;
//   if (!popup) return;

//   const win = popup.ownerDocument?.defaultView;
//   if (!win) return;

//   const reader = (win as any).Zotero?.Reader?.getByWindow?.(win);
//   if (!reader) return;

//   const selection = reader._lastSelection;
//   const text = selection?.text;
//   if (!text) return;

//   const annotation = selection?.annotation;
//   if (!annotation) return;

//   (win as any).Zotero?.PaneManager?.show("zotero-pane", "zotero-view-item");

//   const item = (win as any).Zotero?.Reader?.getWindowReader?.(win)?.find(
//     (r: any) => r === reader,
//   )?.item;
//   if (!item) return;

//   const parentItem = item.parentItem || item;
//   const note = new (win as any).Zotero.Item("note");
//   note.setNote(
//     `<p><strong>Annotation:</strong></p><blockquote>${text}</blockquote>`,
//   );
//   note.parentKey = parentItem.key;
//   note.saveTx();

//   const btn = group.querySelector(
//     "button:last-child",
//   ) as HTMLButtonElement | null;
//   if (btn) {
//     btn.classList.add("active");
//     setTimeout(() => btn.classList.remove("active"), 800);
//   }
// }

// function injectButtons(popup: HTMLElement, doc: Document): void {
//   const existing = doc.getElementById(GROUP_ID);
//   if (existing) existing.remove();

//   const toolToggle = popup.querySelector(".tool-toggle");
//   if (!toolToggle) return;

//   const group = createButtonGroup(doc);
//   toolToggle.after(group);
// }

function tryInject(doc: Document): void {
  const popup = doc.querySelector(".view-popup") as HTMLElement | null;
  if (!popup || doc.getElementById(GROUP_ID)) return;

  const toolToggle = popup.querySelector(".tool-toggle");
  if (toolToggle) {
    const group = createButtonGroup(doc);
    toolToggle.after(group);
  }
}

function observeDoc(doc: Document): void {
  if (observedDocs.has(doc)) return;
  observedDocs.add(doc);

  tryInject(doc);

  const observer = new doc.defaultView!.MutationObserver(() => {
    tryInject(doc);
  });
  observer.observe(doc.body, {
    childList: true,
    subtree: true,
    // attributes: true,
    // attributeFilter: ["class", "style"],
  });
  observers.push(observer);
}

const SelectionPopupHandler: _ZoteroTypes.Reader.EventHandler<
  "renderTextSelectionPopup"
> = (event) => {
  const doc = event.reader._iframeWindow?.document;
  if (doc) observeDoc(doc);
};

export function registerTextSelectionPopupButtons(): void {
  if (listenerRegistered) return;

  Zotero.Reader.registerEventListener(
    "renderTextSelectionPopup",
    SelectionPopupHandler,
    LISTENER_ID,
  );
  listenerRegistered = true;
  ztoolkit.log("Popup buttons registered");
}

export function unregisterTextSelectionPopupButtons(): void {
  if (!listenerRegistered) return;

  Zotero.Reader.unregisterEventListener(
    "renderTextSelectionPopup",
    SelectionPopupHandler,
  );

  listenerRegistered = false;

  observers.forEach((observer) => observer.disconnect());
  observers.length = 0;
  observedDocs.clear();

  // 全局清理
  Zotero.getMainWindows().forEach((win) => {
    const popupDocs = [
      win.document,
      ...Array.from(win.document.querySelectorAll("iframe")).map(
        (f) => (f as HTMLIFrameElement).contentDocument,
      ),
    ];
    popupDocs.forEach((d) => d?.getElementById(GROUP_ID)?.remove());
  });

  ztoolkit.log("Popup buttons unregistered");
}
