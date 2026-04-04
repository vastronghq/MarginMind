import { getPref } from "../../utils/prefs";

export async function saveSelectionAsAnnotation(
  selectedIDs: string[],
  messages: { id: string; role: string; text: string }[],
  selectedAnnotation: _ZoteroTypes.Annotations.AnnotationJson,
  attachmentItemID: number,
  annotationColor: string,
): Promise<void> {
  const attachment = Zotero.Items.get(attachmentItemID) as
    | Zotero.Item
    | undefined;
  if (!attachment || !attachment.isAttachment())
    throw new Error("Attachment not found for annotation.");

  const comment = messages
    .filter((m) => selectedIDs.includes(m.id))
    .map((m) => `# ${m.role.toUpperCase()}\n${m.text}`)
    .join("\n\n");

  const annotation = new Zotero.Item("annotation") as any;
  annotation.libraryID = attachment.libraryID;
  annotation.parentKey = attachment.key;
  annotation.annotationType = selectedAnnotation.type || "highlight";
  annotation.annotationPageLabel = selectedAnnotation.position.pageIndex + 1;
  annotation.annotationText = selectedAnnotation.text || "";
  annotation.annotationComment = comment;
  annotation.annotationColor = selectedAnnotation.color || annotationColor;
  annotation.annotationPosition = JSON.stringify({
    pageIndex: selectedAnnotation.position.pageIndex,
    rects: selectedAnnotation.position.rects || [],
  });
  annotation.annotationSortIndex =
    selectedAnnotation.sortIndex ||
    `00000|${Date.now().toString().padStart(6, "0")}|00000`;
  await annotation.saveTx();
}
