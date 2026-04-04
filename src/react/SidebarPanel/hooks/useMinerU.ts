import { useState, useCallback, useEffect } from "react";
import { parsePDFWithMinerU, getMinerUApiKey } from "../../../modules/mineru";
import {
  hasCache,
  readCacheSync,
  writeCache,
} from "../../../modules/markdownCache";

export const useMinerU = (
  attachmentItemID: number | null,
  initialMarkdownStatus: "none" | "cached" | "parsing" | "error",
  initialMarkdownContent: string | null,
) => {
  const [markdownStatus, setMarkdownStatus] = useState(initialMarkdownStatus);
  const [markdownContent, setMarkdownContent] = useState<string | null>(
    initialMarkdownContent,
  );
  const [parseProgress, setParseProgress] = useState("");

  useEffect(() => {
    setMarkdownStatus(initialMarkdownStatus);
    setMarkdownContent(initialMarkdownContent);
    setParseProgress("");
  }, [initialMarkdownStatus, initialMarkdownContent, attachmentItemID]);

  const triggerParse = useCallback(async () => {
    if (!attachmentItemID) return;

    if (hasCache(attachmentItemID)) {
      const cached = readCacheSync(attachmentItemID);
      if (cached) {
        console.log("Using cached markdown");
        setMarkdownStatus("cached");
        setMarkdownContent(cached);
        return;
      }
    }

    const apiKey = getMinerUApiKey();
    if (!apiKey) {
      setMarkdownStatus("error");
      setParseProgress("MinerU API key not configured");
      return;
    }

    const attachment = Zotero.Items.get(attachmentItemID) as
      | Zotero.Item
      | undefined;
    if (!attachment || !attachment.isAttachment()) {
      setMarkdownStatus("error");
      setParseProgress("Attachment not found");
      return;
    }

    const filePath = attachment.getFilePath();
    if (!filePath) {
      setMarkdownStatus("error");
      setParseProgress("File path not available");
      return;
    }

    setMarkdownStatus("parsing");
    setParseProgress("Starting...");

    try {
      const markdown = await parsePDFWithMinerU(filePath, (msg) => {
        setParseProgress(msg);
      });
      writeCache(attachmentItemID, markdown);

      setMarkdownStatus("cached");
      setMarkdownContent(markdown);
      setParseProgress("");
    } catch (error) {
      setMarkdownStatus("error");
      setParseProgress(error instanceof Error ? error.message : "Parse failed");
    }
  }, [attachmentItemID]);

  return {
    markdownStatus,
    markdownContent,
    parseProgress,
    triggerParse,
  };
};
