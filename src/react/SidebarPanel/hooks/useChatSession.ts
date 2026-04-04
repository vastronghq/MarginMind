import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import {
  streamAIReply,
  formatAIError,
  type AIChatMessage,
} from "../../../modules/aiService";
import { loadAISettings } from "../../../modules/aiPrefs";
import type { SidebarPanelData } from "../../bridge";
import {
  uid,
  EMPTY_TITLE,
  createSession,
  trimTitle,
  isAbortError,
} from "../utils";

export type ChatRole = "assistant" | "user";
export type ChatMessage = {
  id: string;
  role: ChatRole;
  text: string;
  displayText?: string;
  contextText?: string;
  meta?: string;
  thinking?: string;
  thoughtDuration?: number;
};
export type ChatSession = {
  id: string;
  title: string;
  updatedAt: number;
  messages: ChatMessage[];
  draft: string;
};

type MarginMindChatWindow = Window & {
  __marginmindItemPaneChatState?: PersistedState;
};
type PersistedState = {
  sessions: ChatSession[];
  activeSessionID: string;
  activeContext: SidebarPanelData | null;
};

const readPersisted = (): PersistedState | null =>
  (globalThis as unknown as MarginMindChatWindow)
    .__marginmindItemPaneChatState ?? null;
const writePersisted = (state: PersistedState) => {
  (
    globalThis as unknown as MarginMindChatWindow
  ).__marginmindItemPaneChatState = state;
};
const seedState = (data: SidebarPanelData | null): PersistedState => {
  const saved = readPersisted();
  if (!saved?.sessions?.length) {
    const first = createSession();
    return {
      sessions: [first],
      activeSessionID: first.id,
      activeContext: data,
    };
  }
  const activeExists = saved.sessions.some(
    (s) => s.id === saved.activeSessionID,
  );
  return {
    sessions: saved.sessions,
    activeSessionID: activeExists
      ? saved.activeSessionID
      : saved.sessions[0].id,
    activeContext: saved.activeContext ?? data,
  };
};

const buildUserPrompt = (
  userPrompt: string,
  ctx: SidebarPanelData | null,
  systemPrompt: string,
  markdownContent: string | null,
  isFirstRound: boolean,
) => {
  const contextLines: string[] = [];
  const lines: string[] = [];

  if (isFirstRound && markdownContent) {
    contextLines.push("Full paper content (parsed from PDF):");
    contextLines.push(markdownContent);
    contextLines.push("");
  }

  contextLines.push("Paper context:");
  contextLines.push(`Title: ${ctx?.title ?? "(none)"}`);
  contextLines.push(`Creators: ${ctx?.creators ?? "(none)"}`);
  contextLines.push(`Year: ${ctx?.year ?? "(none)"}`);
  contextLines.push(`Key: ${ctx?.keyText ?? "(none)"}`);
  contextLines.push(`Abstract: ${ctx?.abstractPreview ?? "(none)"}`);
  contextLines.push("");
  contextLines.push("System prompt:");
  contextLines.push(systemPrompt);

  lines.push(...contextLines);
  lines.push("");
  lines.push("User request:");
  lines.push(userPrompt);

  return {
    fullText: lines.join("\n"),
    contextText: contextLines.join("\n"),
  };
};

export const useChatSession = (
  data: SidebarPanelData | null,
  markdownContent: string | null,
) => {
  const seeded = useMemo(() => seedState(data), [data]);
  const [sessions, setSessions] = useState<ChatSession[]>(seeded.sessions);
  const [activeSessionID, setActiveSessionID] = useState(
    seeded.activeSessionID,
  );
  const [activeContext, setActiveContext] = useState<SidebarPanelData | null>(
    seeded.activeContext ?? data ?? null,
  );
  const [isSending, setIsSending] = useState(false);
  const [requestError, setRequestError] = useState("");

  const abortControllerRef = useRef<AbortController | null>(null);
  const thinkingStartRef = useRef<number | null>(null);

  const settings = loadAISettings();
  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeSessionID) ?? sessions[0],
    [sessions, activeSessionID],
  );
  const messages = activeSession?.messages ?? [];
  const draft = activeSession?.draft ?? "";

  const patchSession = useCallback(
    (id: string, fn: (s: ChatSession) => ChatSession) =>
      setSessions((curr) =>
        curr.map((s) =>
          s.id === id ? { ...fn(s), updatedAt: Date.now() } : s,
        ),
      ),
    [],
  );
  const patchActive = useCallback(
    (fn: (s: ChatSession) => ChatSession) => {
      if (activeSession) patchSession(activeSession.id, fn);
    },
    [activeSession, patchSession],
  );

  const showError = useCallback((text: string, ms = 5000) => {
    setRequestError(text);
    setTimeout(() => setRequestError(""), ms);
  }, []);

  const updateDraft = useCallback(
    (next: string) =>
      setSessions((curr) =>
        curr.map((s) =>
          s.id !== activeSessionID
            ? s
            : s.draft === next
              ? s
              : { ...s, draft: next },
        ),
      ),
    [activeSessionID],
  );
  const clearDraft = useCallback(() => updateDraft(""), [updateDraft]);
  const stopSending = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  const createNewSession = useCallback(() => {
    const n = createSession();
    setSessions((curr) => [n, ...curr]);
    setActiveSessionID(n.id);
    setRequestError("");
  }, []);

  const normalizePrompt = useCallback(
    (input: string, base: ChatMessage[]) => {
      const text = input.trim();
      if (!text) return null;
      const isFirstRound = base.length === 0;
      const { fullText, contextText } = buildUserPrompt(
        text,
        activeContext,
        settings.systemPrompt,
        markdownContent,
        isFirstRound,
      );
      return {
        text: fullText,
        messages: [
          ...base,
          {
            id: uid("user"),
            role: "user" as const,
            text: fullText,
            displayText: text,
            contextText: contextText,
          },
        ],
      };
    },
    [activeContext, settings.systemPrompt, markdownContent],
  );

  const send = useCallback(
    async (prompt: string) => {
      if (!activeSession || isSending) return;
      const norm = normalizePrompt(prompt, activeSession.messages);
      if (!norm) return;

      const sessionID = activeSession.id;
      patchSession(sessionID, (s) => ({
        ...s,
        title: s.title === EMPTY_TITLE ? trimTitle(norm.text) : s.title,
        messages: norm.messages,
        draft: "",
      }));

      setIsSending(true);
      setRequestError("");
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const assistantID = uid("assistant");
      patchSession(sessionID, (s) => ({
        ...s,
        messages: [
          ...s.messages,
          {
            id: assistantID,
            role: "assistant",
            text: "",
            meta: `${settings.provider} / ${settings.model}`,
          },
        ],
      }));

      try {
        const apiMessages: AIChatMessage[] = [
          ...messages.map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.text,
          })),
          { role: "user", content: norm.text },
        ];

        console.log(apiMessages);

        let full = "";
        let thinking = "";
        let streamError: unknown = null;
        thinkingStartRef.current = null;

        const stream = streamAIReply({
          settings,
          messages: apiMessages,
          abortSignal: controller.signal,
        });

        for await (const chunk of stream) {
          if (chunk.type === "thinking") {
            if (thinkingStartRef.current === null) {
              thinkingStartRef.current = Date.now();
            }
            thinking += chunk.content;
          } else {
            full += chunk.content;
          }
          patchSession(sessionID, (s) => ({
            ...s,
            messages: s.messages.map((m) =>
              m.id === assistantID
                ? {
                    ...m,
                    text: full,
                    thinking: thinking || undefined,
                  }
                : m,
            ),
          }));
        }

        if (thinkingStartRef.current !== null) {
          const duration = Math.max(
            1,
            Math.round((Date.now() - thinkingStartRef.current) / 1000),
          );
          patchSession(sessionID, (s) => ({
            ...s,
            messages: s.messages.map((m) =>
              m.id === assistantID ? { ...m, thoughtDuration: duration } : m,
            ),
          }));
        }

        if (!full.trim()) {
          streamError = new Error(
            "Model returned an empty response. Check provider/model/API key or try again.",
          );
        }

        if (streamError) {
          throw streamError;
        }
      } catch (error) {
        if (isAbortError(error)) return;
        const msg = formatAIError(error);
        showError(msg);
        patchSession(sessionID, (s) => ({
          ...s,
          messages: s.messages.map((m) =>
            m.id === assistantID
              ? {
                  ...m,
                  text: `Request failed: ${msg}`,
                  meta: "Error",
                }
              : m,
          ),
        }));
      } finally {
        abortControllerRef.current = null;
        setIsSending(false);
      }
    },
    [
      activeSession,
      isSending,
      normalizePrompt,
      messages,
      settings,
      patchSession,
      showError,
    ],
  );

  useEffect(() => {
    if (!sessions.length) {
      const f = createSession();
      setSessions([f]);
      setActiveSessionID(f.id);
      return;
    }
    if (!sessions.some((s) => s.id === activeSessionID))
      setActiveSessionID(sessions[0].id);
  }, [sessions, activeSessionID]);

  useEffect(() => {
    if (data) setActiveContext(data);
  }, [data]);

  useEffect(
    () => writePersisted({ sessions, activeSessionID, activeContext }),
    [sessions, activeSessionID, activeContext],
  );


  return {
    sessions,
    setSessions,
    activeSessionID,
    setActiveSessionID,
    activeContext,
    setActiveContext,
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
    setRequestError,
  };
};
