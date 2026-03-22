import type { InSituAIReactWindow } from "./bridge";
import { mountItemPane } from "./itemPane/mount";

const reactWindow = globalThis as unknown as InSituAIReactWindow;

reactWindow.__insituaiReact = {
  renderItemPane: mountItemPane,
};
reactWindow.__insituaiReactLoaded = true;
