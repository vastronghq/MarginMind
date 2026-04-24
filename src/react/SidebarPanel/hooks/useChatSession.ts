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

type PersistedState = {
  sessions: ChatSession[];
  activeSessionID: string;
  activeContext: SidebarPanelData | null;
};

const DB_TABLE = "sessions";

const getDbPath = () =>
  PathUtils.join(Zotero.DataDirectory.dir, "marginmind", "sessions.sqlite");

let db: any = null;
let dbInitialized = false;

const getDb = async (): Promise<any> => {
  if (db) return db;
  const dbDir = PathUtils.join(Zotero.DataDirectory.dir, "marginmind");
  await IOUtils.makeDirectory(dbDir, { ignoreExisting: true });
  db = new Zotero.DBConnection(getDbPath());
  await db.queryAsync("SELECT 1");
  return db;
};

const ensureTable = async () => {
  if (dbInitialized) return;
  const database = await getDb();
  await database.queryAsync(
    `CREATE TABLE IF NOT EXISTS ${DB_TABLE} (
      id TEXT PRIMARY KEY,
      title TEXT,
      updated_at INTEGER,
      messages TEXT
    )`,
  );
  dbInitialized = true;
};

const readFromDb = async (): Promise<PersistedState | null> => {
  try {
    await ensureTable();
    const database = await getDb();
    const rows = await database.queryAsync(
      `SELECT id, title, updated_at, messages FROM ${DB_TABLE}`,
    );
    if (!rows || !rows.length) return null;
    const sessions: ChatSession[] = [];
    for (const row of rows) {
      const messages = row.messages ? JSON.parse(row.messages) : [];
      const safeMessages: ChatMessage[] = Array.isArray(messages)
        ? messages.filter(
            (m: unknown) =>
              m &&
              typeof m === "object" &&
              typeof (m as { role: string }).role === "string" &&
              typeof (m as { text: string }).text === "string",
          )
        : [];
      sessions.push({
        id: row.id,
        title: row.title || EMPTY_TITLE,
        updatedAt: row.updated_at || Date.now(),
        messages: safeMessages,
        draft: "",
      });
    }
    if (!sessions.length) return null;
    const latest = sessions.reduce((a, b) =>
      a.updatedAt > b.updatedAt ? a : b,
    );
    return {
      sessions,
      activeSessionID: latest.id,
      activeContext: null,
    };
  } catch {
    return null;
  }
};

const saveSessionToDb = async (session: ChatSession) => {
  await ensureTable();
  const database = await getDb();
  const messagesJson = JSON.stringify(session.messages);
  await database.queryAsync(
    `INSERT OR REPLACE INTO ${DB_TABLE} (id, title, updated_at, messages) VALUES (?, ?, ?, ?)`,
    [session.id, session.title, session.updatedAt, messagesJson],
  );
};

const deleteSessionFromDb = async (id: string) => {
  await ensureTable();
  const database = await getDb();
  await database.queryAsync(`DELETE FROM ${DB_TABLE} WHERE id = ?`, [id]);
};

const clearAllFromDb = async () => {
  await ensureTable();
  const database = await getDb();
  await database.queryAsync(`DELETE FROM ${DB_TABLE}`);
};

export async function cleanupEmptySessions() {
  const db = await getDb();
  try {
    // 插件启动的时候清理 messages 为 '[]'、NULL 或者长度为 0 的session
    await db.queryAsync(`
      DELETE FROM sessions 
      WHERE messages IS NULL 
         OR messages = '[]' 
         OR messages = ''
    `);
    ztoolkit.log("MarginMind: Cleaned up empty sessions from database.");
  } catch (e) {
    ztoolkit.log("MarginMind: Failed to cleanup sessions: " + e);
  }
}

const seedState = async (
  data: SidebarPanelData | null,
): Promise<PersistedState> => {
  const saved = await readFromDb();
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
  const [initialized, setInitialized] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionID, setActiveSessionID] = useState("");
  const [activeContext, setActiveContext] = useState<SidebarPanelData | null>(
    data,
  );
  const [isSending, setIsSending] = useState(false);
  const [requestError, setRequestError] = useState("");

  useEffect(() => {
    if (initialized) return;
    const load = async () => {
      const saved = await seedState(data);
      setSessions(saved.sessions);
      setActiveSessionID(saved.activeSessionID);
      setActiveContext(saved.activeContext ?? data ?? null);
      setInitialized(true);
    };
    load();
  }, [data, initialized]);

  useEffect(() => {
    if (!initialized) return;
    if (!sessions.length) return;
    const session = sessions.find((s) => s.id === activeSessionID);
    if (session) saveSessionToDb(session);
  }, [sessions, activeSessionID, initialized]);

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
    // saveSessionToDb(n);
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
        deleteSessionFromDb(id);
        return;
      }
      setSessions(remaining);
      if (activeSessionID === id) setActiveSessionID(remaining[0].id);
      setRequestError("");
      deleteSessionFromDb(id);
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
    async (prompt: string, baseMessages?: ChatMessage[]) => {
      if (!activeSession || isSending) return;
      const base = baseMessages ?? activeSession.messages;
      const norm = normalizePrompt(prompt, base);
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
