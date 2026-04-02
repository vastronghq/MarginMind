import { config } from "../../package.json";

const GROUP_ID = `${config.addonRef}-text-selection-popup-btn-group`;
const LISTENER_ID = `${config.addonRef}-text-selection-popup-listener`;

let listenerRegistered = false;

const docObservers = new Map<Document, MutationObserver>();

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

// ── Selection capture (single source of truth) ───────────────────────────────

export let latestSelectionText = "";
export let latestSelectionAnnotation: _ZoteroTypes.Annotations.AnnotationJson | null =
  null;

// ── Popup action callback (SidebarPanel registers its send handler) ──────────

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

// ── Button creation ──────────────────────────────────────────────────────────

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
  btn.style.cursor = "pointer";
  btn.addEventListener("click", () => handleAction(action, prompt), true);
  return btn;
}

function handleAction(action: PopupAction, prompt?: string): void {
  const text = latestSelectionText;
  if (!text) return;

  if (actionCallback) {
    actionCallback(action, text);
  }
}

// ── Inject ───────────────────────────────────────────────────────────────────

function tryInject(doc: Document): void {
  const popup = doc.querySelector(".view-popup") as HTMLElement | null;
  if (!popup || doc.getElementById(GROUP_ID)) return;

  const toolToggle = popup.querySelector(".tool-toggle");
  if (!toolToggle) return;

  const container = doc.createElement("div");
  container.id = GROUP_ID;

  const row1 = doc.createElement("div");
  row1.className = "tool-toggle";
  row1.appendChild(
    createSingleButton(doc, "Explain", "explain", PROMPTS.explainSelection),
  );
  row1.appendChild(
    createSingleButton(doc, "Critique", "critique", PROMPTS.critiqueSelection),
  );
  container.appendChild(row1);

  const row2 = doc.createElement("div");
  row2.className = "tool-toggle";
  row2.appendChild(
    createSingleButton(
      doc,
      "Bulletize",
      "bulletize",
      PROMPTS.bulletizeSelection,
    ),
  );
  row2.appendChild(
    createSingleButton(
      doc,
      "Translate",
      "translate",
      PROMPTS.translateSelection,
    ),
  );
  container.appendChild(row2);

  const row3 = doc.createElement("div");
  row3.className = "tool-toggle";
  row3.appendChild(createSingleButton(doc, "Insert", "insert"));
  container.appendChild(row3);

  toolToggle.after(container);
}

// ── Observer lifecycle ────────────────────────────────────────────────────────

function observeDoc(doc: Document): void {
  // Disconnect any existing observer for this doc
  const existing = docObservers.get(doc);
  if (existing) {
    existing.disconnect();
    docObservers.delete(doc);
  }

  tryInject(doc);

  const observer = new doc.defaultView!.MutationObserver(() => {
    tryInject(doc);
  });
  observer.observe(doc.body, {
    childList: true,
    subtree: true,
  });
  docObservers.set(doc, observer);
}

// ── Single handler: capture selection + inject buttons ───────────────────────

const PopupHandler: _ZoteroTypes.Reader.EventHandler<
  "renderTextSelectionPopup"
> = (event) => {
  // Capture selection text
  const annotation = event.params.annotation;
  const text = annotation.text?.trim();
  if (text) {
    const page = annotation.position.pageIndex + 1;
    latestSelectionText = `${text} (page ${page})`;
    latestSelectionAnnotation = annotation;
  }

  // Inject buttons into popup
  const doc = event.reader._iframeWindow?.document;
  if (doc) observeDoc(doc);
};

// ── Register / Unregister ────────────────────────────────────────────────────

export function registerTextSelectionPopupButtons(): void {
  if (listenerRegistered) return;

  Zotero.Reader.registerEventListener(
    "renderTextSelectionPopup",
    PopupHandler,
    LISTENER_ID,
  );
  listenerRegistered = true;
  ztoolkit.log("Popup buttons registered");
}

export function unregisterTextSelectionPopupButtons(): void {
  if (!listenerRegistered) return;

  Zotero.Reader.unregisterEventListener(
    "renderTextSelectionPopup",
    PopupHandler,
  );
  listenerRegistered = false;

  for (const observer of docObservers.values()) {
    observer.disconnect();
  }
  docObservers.clear();

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
