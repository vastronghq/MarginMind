import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Card, CardTitle, CardDescription } from "@/components/ui/card";
import { getPref } from "../../utils/prefs";
import {
  registerPopupActionCallback,
  unregisterPopupActionCallback,
} from "../../modules/popupButtons";
import type { SidebarPanelData } from "../bridge";
import { useChatSession } from "./hooks/useChatSession";
import { useMinerU } from "./hooks/useMinerU";
import { useMessageSelection } from "./hooks/useMessageSelection";
import { MessageBubble } from "./components/MessageBubble";
import {
  HistoryPanel,
  HeaderBar,
  ScrollToBottomButton,
  SendingIndicator,
} from "./components/HeaderComponents";
import { InputArea } from "./components/InputArea";

type SidebarPanelProps = {
  data: SidebarPanelData | null;
  selectedAnnotation: _ZoteroTypes.Annotations.AnnotationJson | null;
  markdownStatus: "none" | "cached" | "parsing" | "error";
  markdownContent: string | null;
};

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

export function SidebarPanel({
  data,
  selectedAnnotation,
  markdownStatus: initialMarkdownStatus,
  markdownContent: initialMarkdownContent,
}: SidebarPanelProps) {
  const messageRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);
  const prevMsgCountRef = useRef(0);
  const draftRef = useRef("");
  const sendRef = useRef<((prompt: string) => Promise<void>) | null>(null);
  const [showJump, setShowJump] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isSavingAnnotation, setIsSavingAnnotation] = useState(false);
  const [tokenStats, setTokenStats] = useState({
    totalInputTokens: 0,
    totalOutputTokens: 0,
    currentContextTokens: 0,
  });

  const { markdownStatus, markdownContent, parseProgress, triggerParse } =
    useMinerU(
      data?.attachmentItemID ?? null,
      initialMarkdownStatus,
      initialMarkdownContent,
    );

  const {
    sessions,
    setActiveSessionID,
    activeContext,
    isSending,
    requestError,
    showError,
    draft,
    messages,
    activeSession,
    updateDraft,
    clearDraft,
    stopSending,
    send,
    createNewSession,
    patchSession,
  } = useChatSession(data, markdownContent);

  const {
    isSelectionMode,
    selectedIDs,
    toggleSelected,
    toggleSelectionWithAnyClick,
    clearSelectionMode,
  } = useMessageSelection();

  const markdownFontSize =
    (getPref("markdownFontSize") as string) || "text-[14px]";
  const annotationColor = getPref("annotationColor");

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    sendRef.current = send;
  }, [send]);

  useEffect(() => {
    setTokenStats({
      totalInputTokens: 0,
      totalOutputTokens: 0,
      currentContextTokens: 0,
    });
  }, [activeSession?.id]);

  useEffect(() => {
    registerPopupActionCallback((action, selectedText, prompt) => {
      if (action === "add") {
        updateDraft(
          draftRef.current.trim()
            ? `${draftRef.current.trim()}\n\n${selectedText}`
            : selectedText,
        );
        return;
      }
      if (!prompt) return;
      const fullPrompt = `${prompt}\n\n${selectedText}`;
      void sendRef.current?.(fullPrompt);
    });
    return () => unregisterPopupActionCallback();
  }, [updateDraft]);

  useEffect(() => {
    const list = messageRef.current;
    if (!list) return;

    const msgCount = messages.length;
    const isNewMessage = msgCount > prevMsgCountRef.current;
    prevMsgCountRef.current = msgCount;

    if (isNewMessage) {
      autoScrollRef.current = true;
      requestAnimationFrame(() => {
        list.scrollTo({
          top: list.scrollHeight,
          behavior: "smooth",
        });
      });
      return;
    }

    if (autoScrollRef.current && isSending) {
      list.scrollTo({
        top: list.scrollHeight,
        // behavior: "smooth",
      });
    }
  }, [messages, isSending]);

  useEffect(() => {
    const list = messageRef.current;
    if (!list) return;
    const onScroll = () => {
      const nearBottom =
        list.scrollHeight - list.scrollTop - list.clientHeight <= 300;
      autoScrollRef.current = nearBottom;
      setShowJump(!nearBottom);
    };
    onScroll();
    list.addEventListener("scroll", onScroll, { passive: true });
    return () => list.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (isSending) return;
    const list = messageRef.current;
    if (!list) return;
    list
      .querySelectorAll<HTMLDetailsElement>(
        "[data-thinking-section] > details[open]",
      )
      .forEach((el) => (el.open = false));
  }, [isSending]);

  const jumpToLatest = useCallback(() => {
    const el = messageRef.current;
    if (!el) return;
    autoScrollRef.current = true;
    setShowJump(false);
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, []);

  const handleSelectSession = useCallback(
    (id: string) => {
      setActiveSessionID(id);
    },
    [setActiveSessionID],
  );

  const handleSaveAnnotation = useCallback(async () => {
    if (!selectedAnnotation || !activeContext?.attachmentItemID) return;
    setIsSavingAnnotation(true);
    try {
      await saveSelectionAsAnnotation(
        selectedIDs,
        messages,
        selectedAnnotation,
        activeContext.attachmentItemID,
        annotationColor,
      );
      clearSelectionMode();
    } catch (error) {
      showError(
        error instanceof Error ? error.message : "Failed to save annotation.",
        2000,
      );
    } finally {
      setIsSavingAnnotation(false);
    }
  }, [
    selectedIDs,
    messages,
    activeContext,
    annotationColor,
    clearSelectionMode,
    showError,
    selectedAnnotation,
  ]);

  const handleDeleteMessages = useCallback(() => {
    if (!activeSession || selectedIDs.length === 0) return;
    const selectedSet = new Set(selectedIDs);
    patchSession(activeSession.id, (s) => ({
      ...s,
      messages: s.messages.filter((m) => !selectedSet.has(m.id)),
    }));
    clearSelectionMode();
  }, [activeSession, selectedIDs, patchSession, clearSelectionMode]);

  const canSaveToAnnotation =
    selectedAnnotation != null &&
    !!activeContext?.attachmentItemID &&
    selectedIDs.length > 0 &&
    !isSavingAnnotation;
  const canDeleteSelected = selectedIDs.length > 0 && !isSending;
  const selectedIDSet = useMemo(() => new Set(selectedIDs), [selectedIDs]);

  if (!activeContext && !messages.length) {
    return (
      <Card className="h-full rounded-xl border-[color-mix(in_srgb,var(--fill-primary)_16%,transparent)] bg-[var(--material-sidepane)] px-4 py-5 text-[var(--fill-primary)]">
        <CardTitle className="text-[16px]">No item selected</CardTitle>
        <CardDescription className="mt-1 text-[14px] text-[color-mix(in_srgb,var(--fill-primary)_58%,transparent)]">
          Select an item to open the assistant workspace.
        </CardDescription>
      </Card>
    );
  }

  return (
    <aside className="flex h-full min-h-0 w-full flex-col bg-[var(--material-sidepane)] text-[var(--fill-primary)]">
      <section className="space-y-2 p-2.5">
        <HeaderBar
          // isHistoryOpen={isHistoryOpen}
          onToggleHistory={() => setIsHistoryOpen((v) => !v)}
          onNewChat={() => {
            createNewSession();
            setIsHistoryOpen(false);
          }}
          isSending={isSending}
          activeContext={activeContext}
        />

        {isHistoryOpen ? (
          <HistoryPanel
            sessions={sessions}
            activeSessionID={activeSession?.id ?? sessions[0]?.id}
            onSelectSession={handleSelectSession}
            onClose={() => setIsHistoryOpen(false)}
            onClearSelection={clearSelectionMode}
            isSending={isSending}
          />
        ) : null}
      </section>

      <section
        ref={messageRef}
        className="relative flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-2.5 pb-2.5"
      >
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            isSelectionMode={isSelectionMode}
            isSelected={selectedIDSet.has(message.id)}
            onToggleSelect={toggleSelected}
            onContextMenu={toggleSelectionWithAnyClick}
            markdownFontSize={markdownFontSize}
          />
        ))}

        <SendingIndicator isSending={isSending} />
        <ScrollToBottomButton visible={showJump} onClick={jumpToLatest} />
      </section>

      <InputArea
        draft={draft}
        onDraftChange={updateDraft}
        onSend={send}
        onStop={stopSending}
        onClear={clearDraft}
        isSending={isSending}
        isSelectionMode={isSelectionMode}
        markdownStatus={markdownStatus}
        parseProgress={parseProgress}
        onParse={triggerParse}
        messages={messages}
        markdownContent={markdownContent}
        tokenStats={tokenStats}
        onTokenCount={setTokenStats}
        selectedIDs={selectedIDs}
        onSaveToAnnotation={handleSaveAnnotation}
        canSaveToAnnotation={canSaveToAnnotation}
        isSavingAnnotation={isSavingAnnotation}
        onDelete={handleDeleteMessages}
        canDelete={canDeleteSelected}
        onCancel={clearSelectionMode}
      />

      {requestError ? (
        <div className="px-2.5 pb-2 text-[13px] text-[var(--accent-red,#d14)]">
          {requestError}
        </div>
      ) : null}
    </aside>
  );
}
