import { config } from "../../package.json";

const GROUP_ID = `${config.addonRef}-text-selection-popup-btn-group`;
const LISTENER_ID = `${config.addonRef}-text-selection-popup-listener`;
let listenerRegistered = false;

const observedDocs = new Set<Document>();
const observers: MutationObserver[] = [];

// ── Prompts ──────────────────────────────────────────────────────────────────

const PROMPTS = {
  explainSelection:
    "请你作为本对话领域的专家，先拆解选文中的专业术语与概念，给出它们的定义（如涉及交叉学科，请剥离交叉部分，还原其在原学科中的定义）；再结合选文所处的学科背景，将这些概念串联起来，阐述选文的具体含义。",
  critiqueSelection:
    "对所选文本的假设、方法论和论证进行批判性分析，指出其中的不足之处、未经检验的前提以及牵强的解读。",
  bulletizeSelection: "将所选文本提炼为要点，每条要点保持简洁、清晰。",
  translateSelection:
    "使用规范的学术术语将以下内容翻译成【中文】。确保技术术语符合【计算机科学/化学/生物学/人工智能】领域的标准表述。重要术语保留英文原文，并在括号内附上【中文】翻译。仅输出翻译结果，保持专业、客观的语气。",
};

// ── Callback mechanism (SidebarPanel registers its send handler) ─────────────

type PopupAction =
  | "explain"
  | "critique"
  | "bulletize"
  | "translate"
  | "insert";

type PopupActionCallback = (action: PopupAction, selectedText: string) => void;
let actionCallback: PopupActionCallback | null = null;

export function registerPopupActionCallback(cb: PopupActionCallback): void {
  actionCallback = cb;
}

export function unregisterPopupActionCallback(): void {
  actionCallback = null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getReaderSelectedText(doc: Document): string | null {
  const win = doc.defaultView;
  if (!win) return null;
  const reader = (win as any).Zotero?.Reader?.getByWindow?.(win);
  return reader?._lastSelection?.text ?? null;
}

function forceOpenSidebar(win: Window): void {
  const doc = win.document;
  const selectedType = (win as { Zotero_Tabs?: { selectedType?: string } })
    .Zotero_Tabs?.selectedType;

  let toggleButton: HTMLElement | null = null;
  if (selectedType === "reader") {
    toggleButton = doc.querySelector('[data-l10n-id="toggle-context-pane"]');
  } else if (selectedType === "library") {
    toggleButton = doc.querySelector('[data-l10n-id="toggle-item-pane"]');
  }

  if (!toggleButton) return;

  const splitterId =
    selectedType === "reader"
      ? "splitter#zotero-context-splitter"
      : selectedType === "library"
        ? "splitter#zotero-items-splitter"
        : "";
  if (!splitterId) return;

  const splitter = doc.querySelector(splitterId);
  if (splitter && splitter.getAttribute("state") === "collapsed") {
    toggleButton.click();
  }
}

function createSingleButton(
  doc: Document,
  label: string,
  action: PopupAction,
  prompt?: string,
): HTMLElement {
  const btn = doc.createElement("button");
  btn.tabIndex = -1;
  btn.title = label;
  btn.innerHTML = label;
  btn.className = "highlight";
  // btn.style.height = "22px";
  btn.style.cursor = "pointer";
  btn.addEventListener("click", () => handleAction(doc, action, prompt));
  return btn;
}

function handleAction(
  doc: Document,
  action: PopupAction,
  prompt?: string,
): void {
  ztoolkit.log("action", action);
  // const text = getReaderSelectedText(doc);

  // if (!text) return;

  // const win = doc.defaultView;
  // if (win) forceOpenSidebar(win);

  // if (actionCallback) {
  //   actionCallback(action, text);
  // }
}

// ── Inject ───────────────────────────────────────────────────────────────────
function tryInject(doc: Document): void {
  const popup = doc.querySelector(".view-popup") as HTMLElement | null;
  if (!popup || doc.getElementById(GROUP_ID)) return;

  const toolToggle = popup.querySelector(".tool-toggle");
  if (!toolToggle) return;

  const wrap1 = doc.createElement("div");
  wrap1.id = `${config.addonRef}-text-selection-popup-btn-wrap-1`;
  wrap1.className = "tool-toggle";

  const btn1 = createSingleButton(
    doc,
    "Explain",
    "explain",
    PROMPTS.explainSelection,
  );
  const btn2 = createSingleButton(
    doc,
    "Critique",
    "critique",
    PROMPTS.critiqueSelection,
  );
  wrap1.appendChild(btn1);
  wrap1.appendChild(btn2);

  toolToggle.after(wrap1);

  const wrap2 = doc.createElement("div");
  wrap2.id = `${config.addonRef}-text-selection-popup-btn-wrap-2`;
  wrap2.className = "tool-toggle";

  const btn3 = createSingleButton(
    doc,
    "Bulletize",
    "bulletize",
    PROMPTS.bulletizeSelection,
  );
  const btn4 = createSingleButton(
    doc,
    "Translate",
    "translate",
    PROMPTS.translateSelection,
  );
  wrap2.appendChild(btn3);
  wrap2.appendChild(btn4);

  wrap1.after(wrap2);

  const wrap3 = doc.createElement("div");
  wrap3.id = `${config.addonRef}-text-selection-popup-btn-wrap-3`;
  wrap3.className = "tool-toggle";

  const btn5 = createSingleButton(doc, "Insert", "insert");
  wrap3.appendChild(btn5);
  wrap2.after(wrap3);
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
