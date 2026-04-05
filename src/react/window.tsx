import type { MarginMindReactWindow } from "./bridge";
// import { mountItemPane } from "./itemPane/mount";
import { mountPreferences } from "./PreferencesPanel/mount";
import { mountSidebarPanel } from "./SidebarPanel/mount";
import { config } from "../../package.json";

const reactWindow = globalThis as unknown as MarginMindReactWindow;
const REACT_STYLE_ID = `${config.addonRef}-react-ui-style`;

function ensureReactStyles() {
  const doc = reactWindow.document;
  const href = reactWindow.__marginmindReactStyleURL;
  if (!doc || !href) return;

  let link = doc.getElementById(REACT_STYLE_ID) as HTMLLinkElement | null;
  if (!link) {
    link = doc.createElement("link");
    link.id = REACT_STYLE_ID;
    link.rel = "stylesheet";
    doc.documentElement?.appendChild(link);
  }

  if (link.href !== href) {
    link.href = href;
  }
}

reactWindow.__marginmindReact = {
  // renderItemPane: mountItemPane,
  renderPreferences: mountPreferences,
  renderSidebarPanel: mountSidebarPanel,
};
reactWindow.__marginmindReactLoaded = true;
ensureReactStyles();
