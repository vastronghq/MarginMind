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
type PersistedDiskState = PersistedState & {
  version: number;
  savedAt: number;
};

const CHAT_STORE_DIR = "marginmind";
const CHAT_STORE_FILE = "chat-sessions.json";
const SAVE_DEBOUNCE_MS = 600;

const getChatStoreDirPath = () =>
  PathUtils.join(Zotero.DataDirectory.dir, CHAT_STORE_DIR);
const getChatStoreFilePath = () =>
  PathUtils.join(getChatStoreDirPath(), CHAT_STORE_FILE);

const normalizeMessage = (message: unknown): ChatMessage | null => {
  if (!message || typeof message !== "object") return null;
  const m = message as Partial<ChatMessage>;
  if (m.role !== "assistant" && m.role !== "user") return null;
  if (typeof m.text !== "string") return null;
  return {
    id: typeof m.id === "string" && m.id ? m.id : uid(m.role),
    role: m.role,
    text: m.text,
    displayText: typeof m.displayText === "string" ? m.displayText : undefined,
    contextText: typeof m.contextText === "string" ? m.contextText : undefined,
    meta: typeof m.meta === "string" ? m.meta : undefined,
    thinking: typeof m.thinking === "string" ? m.thinking : undefined,
    thoughtDuration:
      typeof m.thoughtDuration === "number" ? m.thoughtDuration : undefined,
  };
};

const normalizeSession = (session: unknown): ChatSession | null => {
  if (!session || typeof session !== "object") return null;
  const s = session as Partial<ChatSession>;
  const safeMessages = Array.isArray(s.messages)
    ? s.messages.map(normalizeMessage).filter((m): m is ChatMessage => !!m)
    : [];
  return createSession({
    id: typeof s.id === "string" && s.id ? s.id : uid("session"),
    title: typeof s.title === "string" && s.title ? s.title : EMPTY_TITLE,
    updatedAt: typeof s.updatedAt === "number" ? s.updatedAt : Date.now(),
    draft: typeof s.draft === "string" ? s.draft : "",
    messages: safeMessages,
  });
};

const normalizePersistedState = (input: unknown): PersistedState | null => {
  if (!input || typeof input !== "object") return null;
  const raw = input as Partial<PersistedState>;
  const sessions = Array.isArray(raw.sessions)
    ? raw.sessions.map(normalizeSession).filter((s): s is ChatSession => !!s)
    : [];
  const nonEmptySessions = sessions.filter((s) => s.messages.length > 0);
  if (!nonEmptySessions.length) return null;
  const activeExists = nonEmptySessions.some(
    (s) => s.id === raw.activeSessionID,
  );
  return {
    sessions: nonEmptySessions,
    activeSessionID: activeExists
      ? (raw.activeSessionID as string)
      : nonEmptySessions[0].id,
    activeContext: (raw.activeContext as SidebarPanelData | null) ?? null,
  };
};

const readPersistedFromDisk = (): PersistedState | null => {
  try {
    const filePath = getChatStoreFilePath();
    const file = Zotero.File.pathToFile(filePath);
    if (!file.exists()) return null;
    const raw = Zotero.File.getContents(file);
    if (typeof raw !== "string" || !raw.trim()) return null;
    const parsed = JSON.parse(raw) as
      | Partial<PersistedDiskState>
      | PersistedState;
    const stateSource =
      parsed && typeof parsed === "object" && "version" in parsed
        ? (parsed as Partial<PersistedDiskState>)
        : (parsed as PersistedState);
    return normalizePersistedState(stateSource);
  } catch {
    return null;
  }
};

const writePersistedToDisk = async (state: PersistedState) => {
  try {
    const sessions = state.sessions
      .filter((s) => s.messages.length > 0)
      .map((s) => ({
        ...s,
        messages: s.messages.map((m) => ({ ...m })),
      }));
    const filePath = getChatStoreFilePath();
    if (!sessions.length) {
      if (await IOUtils.exists(filePath)) await IOUtils.remove(filePath);
      return;
    }
    await IOUtils.makeDirectory(getChatStoreDirPath(), {
      ignoreExisting: true,
    });
    const activeExists = sessions.some((s) => s.id === state.activeSessionID);
    const payload: PersistedDiskState = {
      version: 1,
      savedAt: Date.now(),
      sessions,
      activeSessionID: activeExists ? state.activeSessionID : sessions[0].id,
      activeContext: state.activeContext,
    };
    await Zotero.File.putContentsAsync(
      filePath,
      JSON.stringify(payload, null, 2),
    );
  } catch (error) {
    console.error("[MarginMind] Failed to persist chat sessions:", error);
  }
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
  const saved = readPersisted() ?? readPersistedFromDisk();
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
  const persistTimerRef = useRef<ReturnType<
    typeof globalThis.setTimeout
  > | null>(null);

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

  const deleteSession = useCallback(
    (id: string) => {
      if (isSending) return;
      const remaining = sessions.filter((s) => s.id !== id);
      if (remaining.length === sessions.length) return;
      if (!remaining.length) {
        const first = createSession();
        setSessions([first]);
        setActiveSessionID(first.id);
        setRequestError("");
        return;
      }
      setSessions(remaining);
      if (activeSessionID === id) setActiveSessionID(remaining[0].id);
      setRequestError("");
    },
    [sessions, activeSessionID, isSending],
  );

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
        title: s.title === EMPTY_TITLE ? trimTitle(prompt) : s.title,
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
    () => () => {
      if (persistTimerRef.current) {
        globalThis.clearTimeout(persistTimerRef.current);
        persistTimerRef.current = null;
      }
    },
    [],
  );

  useEffect(() => {
    const snapshot = { sessions, activeSessionID, activeContext };
    writePersisted(snapshot);
    if (persistTimerRef.current) {
      globalThis.clearTimeout(persistTimerRef.current);
    }
    persistTimerRef.current = globalThis.setTimeout(() => {
      persistTimerRef.current = null;
      void writePersistedToDisk(snapshot);
    }, SAVE_DEBOUNCE_MS);
  }, [sessions, activeSessionID, activeContext]);

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
    deleteSession,
    patchSession,
    setRequestError,
  };
};
