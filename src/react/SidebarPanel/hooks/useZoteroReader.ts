// import { useCallback } from "react";

// export const useZoteroReader = () => {
//   const handleInternalJump = useCallback(async (href: string) => {
//     if (!href || !href.startsWith("zotero://")) return;

//     try {
//       const url = new URL(href);
//       const itemKey = url.pathname.split("/").pop();
//       const pageStr = url.searchParams.get("page");
//       const regionStr = url.searchParams.get("region");

//       const regionArr: Array<number[]> = JSON.parse(
//         decodeURIComponent(regionStr as string) ?? "[]",
//       );

//       const item: any = Zotero.Items.getByLibraryAndKey(
//         Zotero.Libraries.userLibraryID,
//         itemKey as string,
//       );
//       if (!item) throw new Error(`Item not found: ${itemKey}`);

//       const pageIndex = pageStr ? parseInt(pageStr, 10) - 1 : 0;
//       const location: _ZoteroTypes.Reader.Location = {
//         position: { rects: regionArr, pageIndex: pageIndex },
//       };

//       const reader = await Zotero.Reader.open(item.id, location);
//       reader?.navigate(location);
//     } catch (err) {
//       console.log("Internal jump failed, falling back to launchURL", err);
//       Zotero.launchURL(href);
//     }
//   }, []);

//   const openExternalUrl = useCallback(
//     (href: string) => {
//       if (href.startsWith("zotero://")) {
//         handleInternalJump(href);
//       } else {
//         Zotero.launchURL(href);
//       }
//     },
//     [handleInternalJump],
//   );

//   return {
//     handleInternalJump,
//     openExternalUrl,
//   };
// };
