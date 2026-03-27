import { getLocaleID } from "../utils/locale";
import type { MarginMindReactWindow, ItemPaneData } from "../react/bridge";

const READER_SELECTION_LISTENER_ID = "marginmind-reader-selection";
const ITEM_PANE_MOUNT_ID = "marginmind-item-pane-root";
const READER_PANE_MOUNT_ID = "marginmind-reader-item-pane-root";
const REACT_WINDOW_SCRIPT_URL = `${rootURI}content/scripts/ui.js`;
const REACT_STYLE_URL = `${rootURI}content/styles/ui.css`;
const REACT_ASSET_VERSION =
  __env__ === "development" ? `${Date.now()}` : "production";

const readerBodies = new Set<HTMLDivElement>();
let latestSelectedText = "";
let latestSelectedAnnotation: _ZoteroTypes.Annotations.AnnotationJson | null =
  null;

const readerSelectionHandler: _ZoteroTypes.Reader.EventHandler<
  "renderTextSelectionPopup"
> = (event) => {
  const annotation = event.params.annotation;
  const text = annotation.text?.trim();
  const page = annotation.position.pageIndex + 1;

  if (!text) return;
  updateSelectedText(`${text} (page ${page})`, annotation);
};

function registerItemPaneSection() {
  Zotero.ItemPaneManager.registerSection({
    paneID: "marginmind-item-pane",
    pluginID: addon.data.config.addonID,
    bodyXHTML: `<html:div id="${ITEM_PANE_MOUNT_ID}" />`,
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
    onRender: ({ body, item }) =>
      renderItemPane(body, item, {
        mountId: ITEM_PANE_MOUNT_ID,
        showSelectedText: false,
      }),
  });
}

function registerReaderItemPaneSection() {
  Zotero.ItemPaneManager.registerSection({
    paneID: "marginmind-reader-item-pane",
    pluginID: addon.data.config.addonID,
    bodyXHTML: `<html:div id="${READER_PANE_MOUNT_ID}" />`,
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
      readerBodies.add(body);
      renderItemPane(body, item, {
        mountId: READER_PANE_MOUNT_ID,
        showSelectedText: true,
      });
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
      readerSelectionHandler,
    );
  } catch (_error) {}

  Zotero.Reader.registerEventListener(
    "renderTextSelectionPopup",
    readerSelectionHandler,
    READER_SELECTION_LISTENER_ID,
  );
}

function unregisterReaderSelectionListener() {
  try {
    Zotero.Reader.unregisterEventListener(
      "renderTextSelectionPopup",
      readerSelectionHandler,
    );
  } catch (_error) {}
}

function updateSelectedText(
  text: string,
  annotation: _ZoteroTypes.Annotations.AnnotationJson,
) {
  latestSelectedText = text;
  latestSelectedAnnotation = annotation;

  for (const body of [...readerBodies]) {
    if (!body.isConnected) {
      readerBodies.delete(body);
      continue;
    }

    renderItemPane(body, getBodyItem(body), {
      mountId: READER_PANE_MOUNT_ID,
      showSelectedText: true,
    });
  }
}

function renderItemPane(
  body: HTMLDivElement,
  item: Zotero.Item | undefined,
  options: { mountId: string; showSelectedText: boolean },
) {
  const win = body.ownerDocument?.defaultView as MarginMindReactWindow | null;
  if (!win) {
    throw new Error("Item pane window is unavailable");
  }

  ensureReactBridge(win);

  const container = body.querySelector(`#${options.mountId}`);
  if (!container) {
    throw new Error(`Item pane mount node not found: ${options.mountId}`);
  }

  if (!win.__marginmindReact) {
    throw new Error("React bridge failed to initialize");
  }

  win.__marginmindReact.renderItemPane({
    container,
    data: item ? serializeItem(item) : null,
    showSelectedText: options.showSelectedText,
    selectedText: latestSelectedText,
    selectedAnnotation: options.showSelectedText
      ? latestSelectedAnnotation
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

function getBodyItem(body: HTMLDivElement) {
  const section = body.closest("item-pane-custom-section") as
    | (_ZoteroTypes.ItemPaneCustomSection & { _item?: Zotero.Item })
    | null;
  return section?._item;
}

function serializeItem(item: Zotero.Item): ItemPaneData {
  const title = String(item.getField("title") || "(Untitled)");
  const date = String(item.getField("date") || "");
  const year = date.match(/\d{4}/)?.[0] || "Unknown";
  const abstractText = String(item.getField("abstractNote") || "")
    .replace(/\s+/g, " ")
    .trim();
  const abstractPreview =
    abstractText.length > 180
      ? `${abstractText.slice(0, 180)}...`
      : abstractText || "No abstract";

  return {
    itemID: item.id ?? null,
    attachmentItemID: resolveAttachmentItemID(item),
    title,
    creators: formatCreators(item),
    year,
    abstractPreview,
    keyText: `${item.key} (ID: ${item.id ?? "-"})`,
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
    .map(
      (creator: { name?: string; lastName?: string; firstName?: string }) => {
        if (creator.name) return creator.name;
        return [creator.lastName, creator.firstName].filter(Boolean).join(", ");
      },
    )
    .filter(Boolean);

  return creators.length ? creators.join("; ") : "Unknown";
}

export {
  registerItemPaneSection,
  registerReaderItemPaneSection,
  registerReaderSelectionListener,
  unregisterReaderSelectionListener,
};
