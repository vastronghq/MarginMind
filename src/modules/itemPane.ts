/*
 * Copyright (c) 2026 by hqwang, All Rights Reserved.
 *
 * @Software     : VScode
 * @Author       : hqwang
 * @Date         : 2026-03-22 13:43:18
 * @LastEditTime : 2026-03-22 18:34:28
 * @Description  :
 */
import { getLocaleID } from "../utils/locale";

const READER_SELECTION_LISTENER_ID = "insituai-reader-selection";
const readerPaneBodies = new Set<any>();
let latestSelectedText = "";

function registerItemPaneSection() {
  Zotero.ItemPaneManager.registerSection({
    paneID: "insituai-item-pane",
    pluginID: addon.data.config.addonID,
    header: {
      l10nID: getLocaleID("item-pane-head-text"),
      icon: "chrome://zotero/skin/16/universal/info.svg",
    },
    sidenav: {
      l10nID: getLocaleID("item-section-example1-sidenav-tooltip"),
      icon: "chrome://zotero/skin/20/universal/note.svg",
    },
    onItemChange: ({ tabType, setEnabled }) => {
      setEnabled(tabType === "library");
      return true;
    },
    onRender: ({ body, item }) => renderItemPane(body, item),
  });
}

function registerReaderItemPaneSection() {
  Zotero.ItemPaneManager.registerSection({
    paneID: "insituai-reader-item-pane",
    pluginID: addon.data.config.addonID,
    header: {
      l10nID: getLocaleID("item-pane-head-text"),
      icon: "chrome://zotero/skin/16/universal/info.svg",
    },
    sidenav: {
      l10nID: getLocaleID("item-section-example1-sidenav-tooltip"),
      icon: "chrome://zotero/skin/20/universal/note.svg",
    },
    onItemChange: ({ tabType, setEnabled }) => {
      setEnabled(tabType === "reader");
      return true;
    },
    onRender: ({ body, item }) => {
      readerPaneBodies.add(body);
      renderItemPane(body, item, { showSelectedText: true });
    },

    sectionButtons: [
      {
        type: "test",
        icon: "chrome://zotero/skin/16/universal/note.svg",
        l10nID: getLocaleID("item-section-example2-button-tooltip"),
        onClick: ({ item }) => {
          ztoolkit.log("Section clicked!", item?.id);
        },
      },
    ],
  });
}

function registerReaderSelectionListener() {
  try {
    Zotero.Reader.unregisterEventListener(
      "renderTextSelectionPopup",
      READER_SELECTION_LISTENER_ID,
    );
  } catch (e) {}

  Zotero.Reader.registerEventListener(
    "renderTextSelectionPopup",
    (event) => {
      const annot = event?.params?.annotation;
      const text = annot.text?.trim();
      const page = annot.position.pageIndex + 1;

      // Zotero.getMainWindow().alert(
      //   "插件级划词抓取成功：\n" + annot.position.rects,
      // );
      if (!text) return;
      updateSelectedText(`page ${page}, ${text}`);
    },
    READER_SELECTION_LISTENER_ID,
  );
}

function unregisterReaderSelectionListener() {
  try {
    Zotero.Reader.unregisterEventListener(
      "renderTextSelectionPopup",
      READER_SELECTION_LISTENER_ID,
    );
  } catch (e) {}
}

function updateSelectedText(text: string) {
  latestSelectedText = text;

  for (const body of [...readerPaneBodies]) {
    const doc = body?.ownerDocument;
    if (!body?.isConnected || !doc) {
      readerPaneBodies.delete(body);
      continue;
    }

    const node = body.querySelector("[data-insituai-selected-text]");
    if (node) {
      node.textContent = latestSelectedText;
    }
  }
}

function renderItemPane(
  body: any,
  item: any,
  options: { showSelectedText?: boolean } = {},
) {
  body.replaceChildren();
  const doc = body.ownerDocument;

  if (!doc) return;
  if (!item) {
    body.appendChild(makeLine(doc, "No item selected", "Select an item"));
    return;
  }

  const title = String(item.getField("title") || "(Untitled)");
  const creators = item
    .getCreators()
    .map((creator: any) => creator)
    .filter(Boolean)
    .join(", ");
  const date = String(item.getField("date") || "");
  const year = date.match(/\d{4}/)?.[0] || "Unknown";
  const abstractText = String(item.getField("abstractNote") || "")
    .replace(/\s+/g, " ")
    .trim();
  const abstractPreview =
    abstractText.length > 180
      ? `${abstractText.slice(0, 180)}...`
      : abstractText || "No abstract";

  body.appendChild(makeLine(doc, "Title", title));
  body.appendChild(makeLine(doc, "Creators", creators || "Unknown"));
  body.appendChild(makeLine(doc, "Year", year));
  body.appendChild(makeLine(doc, "Abstract", abstractPreview));
  body.appendChild(makeLine(doc, "Key", `${item.key} (ID: ${item.id ?? "-"})`));

  if (options.showSelectedText) {
    body.appendChild(
      makeLine(
        doc,
        "Selected Text",
        latestSelectedText || "No selection captured yet",
        { selectedText: true },
      ),
    );
  }
}

function makeLine(
  doc: Document,
  label: string,
  value: string,
  options: { selectedText?: boolean } = {},
) {
  const wrap = ztoolkit.UI.createElement(doc, "div", {
    namespace: "html",
    styles: {
      marginBottom: "8px",
      lineHeight: "1.4",
    },
  });

  const labelNode = ztoolkit.UI.createElement(doc, "div", {
    namespace: "html",
    styles: {
      fontWeight: "600",
      marginBottom: "2px",
    },
    properties: { textContent: label },
  });

  const valueNode = ztoolkit.UI.createElement(doc, "div", {
    namespace: "html",
    styles: {
      color: "var(--fill-primary)",
      wordBreak: "break-word",
    },
    properties: { textContent: value },
  });

  if (options.selectedText) {
    valueNode.setAttribute("data-insituai-selected-text", "true");
  }

  wrap.append(labelNode, valueNode);
  return wrap;
}

export {
  registerItemPaneSection,
  registerReaderItemPaneSection,
  registerReaderSelectionListener,
  unregisterReaderSelectionListener,
};
