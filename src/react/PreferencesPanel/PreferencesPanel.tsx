import { useCallback, useEffect, useRef, useState } from "react";
import { getPref, setPref } from "../../utils/prefs";
import {
  AI_DEFAULTS,
  getDefaultBaseURL,
  getDefaultModel,
  isAIPreset,
  loadAISettings,
  loadPresets,
  resetAISettings,
  saveAISetting,
  savePreset,
  deletePreset,
  applyPreset,
  type AIPreset,
  type AIProvider,
  type AISettings,
} from "../../modules/aiPrefs";
import { listCacheFiles, deleteCaches } from "../../modules/markdownCache";
import { Badge } from "@/components/ui/badge";
import { GeneralSettingsCard } from "./components/GeneralSettingsCard";
import { AIConfigurationCard } from "./components/AIConfigurationCard";
import { MinerUConfigurationCard } from "./components/MinerUConfigurationCard";
import {
  DEFAULT_BASE_SETTINGS,
  FONT_SIZE_OPTIONS,
  type BaseSettings,
  type CacheFileItem,
} from "./types";

// function notify(message: string) {
//   if (typeof globalThis.alert === "function") {
//     globalThis.alert(message);
//     return;
//   }
//   console.warn(message);
// }

export function PreferencesPanel() {
  const [baseSettings, setBaseSettings] = useState<BaseSettings>(
    DEFAULT_BASE_SETTINGS,
  );
  const [aiSettings, setAISettings] = useState<AISettings>(AI_DEFAULTS);
  const [status, setStatus] = useState<"idle" | "saved">("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const importPresetsInputRef = useRef<HTMLInputElement | null>(null);

  // Preset state
  const [presets, setPresets] = useState<AIPreset[]>([]);
  const [activePreset, setActivePreset] = useState<string>("");
  const [saveName, setSaveName] = useState("");
  const [showSaveInput, setShowSaveInput] = useState(false);

  // MinerU state
  const [mineruApiKey, setMineruApiKey] = useState("");
  const [cacheFiles, setCacheFiles] = useState<CacheFileItem[]>([]);
  const [selectedCacheIds, setSelectedCacheIds] = useState<string[]>([]);

  // Load on mount
  useEffect(() => {
    setBaseSettings({
      annotationColor: getPref("annotationColor") || "#8000ff",
      markdownFontSize: getPref("markdownFontSize") || "text-[14px]",
    });
    setAISettings(loadAISettings());
    setPresets(loadPresets());
    setMineruApiKey(getPref("mineruApiKey") || "");
    void loadCacheFiles();
  }, []);

  useEffect(
    () => () => {
      if (timerRef.current) globalThis.clearTimeout(timerRef.current);
    },
    [],
  );

  const markSaved = useCallback(() => {
    setStatus("saved");
    if (timerRef.current) globalThis.clearTimeout(timerRef.current);
    timerRef.current = globalThis.setTimeout(() => setStatus("idle"), 1000);
  }, []);

  const loadCacheFiles = useCallback(async () => {
    const files = await listCacheFiles();
    setCacheFiles(
      files.sort((a, b) => b.modified.getTime() - a.modified.getTime()),
    );
    setSelectedCacheIds([]);
  }, []);

  const handleDeleteSelected = useCallback(async () => {
    const ids = selectedCacheIds.map((id) => parseInt(id, 10));
    await deleteCaches(ids);
    await loadCacheFiles();
    markSaved();
  }, [selectedCacheIds, loadCacheFiles, markSaved]);

  const updateMinerUApiKey = useCallback(
    (value: string) => {
      setMineruApiKey(value);
      setPref("mineruApiKey", value);
      markSaved();
    },
    [markSaved],
  );

  const updateBaseSetting = useCallback(
    <K extends keyof BaseSettings>(key: K, value: BaseSettings[K]) => {
      setBaseSettings((c) => ({ ...c, [key]: value }));
      setPref(key, value as string);
      markSaved();
    },
    [markSaved],
  );

  const updateAISetting = useCallback(
    <K extends keyof AISettings>(key: K, value: AISettings[K]) => {
      setAISettings((c) => ({ ...c, [key]: value }));
      saveAISetting(key, value);
      setActivePreset("");
      markSaved();
    },
    [markSaved],
  );

  const changeProvider = useCallback(
    (provider: AIProvider) => {
      const nextBaseURL = getDefaultBaseURL(provider);
      const nextModel = getDefaultModel(provider);
      const next: AISettings = {
        ...aiSettings,
        provider,
        baseURL: nextBaseURL,
        model: nextModel,
      };
      setAISettings(next);
      saveAISetting("provider", provider);
      saveAISetting("baseURL", nextBaseURL);
      saveAISetting("model", nextModel);
      setActivePreset("");
      markSaved();
    },
    [aiSettings, markSaved],
  );

  const resetAll = useCallback(() => {
    resetAISettings();
    setAISettings(loadAISettings());
    setActivePreset("");
    markSaved();
  }, [markSaved]);

  const handleApplyPreset = useCallback(
    (name: string) => {
      setActivePreset(name);
      const preset = presets.find((p) => p.name === name);
      if (!preset) return;
      applyPreset(preset);
      setAISettings(loadAISettings());
      markSaved();
    },
    [presets, markSaved],
  );

  const handleSavePreset = useCallback(() => {
    const name = saveName.trim();
    if (!name) return;
    savePreset(name, aiSettings);
    setPresets(loadPresets());
    setActivePreset(name);
    setSaveName("");
    setShowSaveInput(false);
    markSaved();
  }, [saveName, aiSettings, markSaved]);

  const handleDeletePreset = useCallback(() => {
    if (!activePreset) return;
    deletePreset(activePreset);
    setPresets(loadPresets());
    setActivePreset("");
    markSaved();
  }, [activePreset, markSaved]);

  const handleExportPresets = useCallback(async () => {
    try {
      // 保存在 Zotero 数据目录下
      const dirPath = PathUtils.join(Zotero.DataDirectory.dir, "marginmind");
      const filePath = PathUtils.join(dirPath, "presets.json");

      // Zotero 7/8 推荐使用 IOUtils
      await IOUtils.makeDirectory(dirPath, { ignoreExisting: true });

      // 直接写入
      await Zotero.File.putContentsAsync(
        filePath,
        JSON.stringify(presets, null, 2),
      );

      Zotero.alert(
        window,
        "Export Successful",
        `Presets have been saved to:\n${filePath}`,
      );

      return filePath;
    } catch (e) {
      // 给用户一个错误反馈
      Zotero.alert(
        window,
        "Export Failed",
        `An error occurred while exporting: ${(e as Error).message}`,
      );
      throw e;
    }
  }, [presets, markSaved]);

  const handleStartImportPresets = useCallback(() => {
    importPresetsInputRef.current?.click();
  }, []);

  const handleImportPresets = useCallback(
    async (event: { target: HTMLInputElement }) => {
      const file = event.target.files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const parsed = JSON.parse(text) as unknown;

        if (!Array.isArray(parsed)) {
          Zotero.alert(window, "Import Failed", "JSON root must be an array.");
          return;
        }

        const imported = parsed.filter(isAIPreset);
        if (!imported.length) {
          Zotero.alert(window, "Import Failed", "No valid presets found.");
          return;
        }

        for (const preset of imported) {
          savePreset(preset.name.trim(), preset.settings as AISettings);
        }

        const nextPresets = loadPresets();
        setPresets(nextPresets);

        if (activePreset && !nextPresets.some((p) => p.name === activePreset)) {
          setActivePreset("");
        }

        markSaved();
        Zotero.alert(
          window,
          "Import Successful",
          `${imported.length} presets imported.`,
        );
      } catch {
        Zotero.alert(window, "Import Failed", "Invalid JSON file.");
      } finally {
        event.target.value = "";
      }
    },
    [activePreset, markSaved],
  );

  const updateQuickActionPrompt = useCallback(
    (
      key: "explain" | "critique" | "bulletize" | "translate" | "summarize",
      value: string,
    ) => {
      const keyMap = {
        explain: "quickActionExplainPrompt",
        critique: "quickActionCritiquePrompt",
        bulletize: "quickActionBulletizePrompt",
        translate: "quickActionTranslatePrompt",
        summarize: "quickActionSummarizePrompt",
      } as const;
      const prefKey = keyMap[key];
      const nextQuickActionPrompts = {
        ...aiSettings.quickActionPrompts,
        [prefKey]: value,
      };
      setAISettings((current) => ({
        ...current,
        quickActionPrompts: nextQuickActionPrompts,
      }));
      saveAISetting("quickActionPrompts", nextQuickActionPrompts);
      setActivePreset("");
      markSaved();
    },
    [aiSettings.quickActionPrompts, markSaved],
  );

  const formatSize = useCallback((bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }, []);

  const formatDate = useCallback((date: Date): string => {
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, []);

  return (
    <section className="relative min-h-[320px] rounded-xl border border-[color-mix(in_srgb,var(--accent-blue)_30%,transparent)] bg-[linear-gradient(145deg,color-mix(in_srgb,var(--material-sidepane)_88%,var(--accent-blue)_12%),var(--material-sidepane))] p-5 text-[var(--fill-primary)]">
      <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-[color-mix(in_srgb,var(--accent-blue)_20%,transparent)] blur-3xl" />

      <div className="flex flex-col gap-5">
        <header className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-[22px] font-semibold tracking-tight">
              MarginMind Preferences
            </h2>
            <Badge
              variant="outline"
              className="border-[color-mix(in_srgb,var(--fill-primary)_16%,transparent)] px-2 py-0 text-[11px] font-medium text-[color-mix(in_srgb,var(--fill-primary)_60%,transparent)]"
            >
              {status === "saved" ? "Saved" : "Auto-save enabled"}
            </Badge>
          </div>
        </header>

        <GeneralSettingsCard
          baseSettings={baseSettings}
          fontSizeOptions={FONT_SIZE_OPTIONS}
          onChangeBaseSetting={updateBaseSetting}
        />

        <AIConfigurationCard
          aiSettings={aiSettings}
          presets={presets}
          activePreset={activePreset}
          showSaveInput={showSaveInput}
          saveName={saveName}
          onReset={resetAll}
          onApplyPreset={handleApplyPreset}
          onStartSavePreset={() => {
            setSaveName(activePreset || "");
            setShowSaveInput(true);
          }}
          onSavePreset={handleSavePreset}
          onDeletePreset={handleDeletePreset}
          onExportPresets={handleExportPresets}
          onImportPresets={handleStartImportPresets}
          onChangeSaveName={setSaveName}
          onCancelSaveInput={() => setShowSaveInput(false)}
          onChangeProvider={changeProvider}
          onChangeAISetting={updateAISetting}
          quickActionPrompts={{
            explain: aiSettings.quickActionPrompts.quickActionExplainPrompt,
            critique: aiSettings.quickActionPrompts.quickActionCritiquePrompt,
            bulletize: aiSettings.quickActionPrompts.quickActionBulletizePrompt,
            translate: aiSettings.quickActionPrompts.quickActionTranslatePrompt,
            summarize: aiSettings.quickActionPrompts.quickActionSummarizePrompt,
          }}
          onChangeQuickActionPrompt={updateQuickActionPrompt}
        />

        <input
          ref={importPresetsInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden" // 隐藏原生的文件选择框（难看），使用按钮触发其操作
          onChange={(e) => void handleImportPresets({ target: e.target })}
        />

        <MinerUConfigurationCard
          mineruApiKey={mineruApiKey}
          cacheFiles={cacheFiles}
          selectedCacheIds={selectedCacheIds}
          onChangeApiKey={updateMinerUApiKey}
          onRefresh={loadCacheFiles}
          onDeleteSelected={handleDeleteSelected}
          onSelectAll={(checked) => {
            setSelectedCacheIds(checked ? cacheFiles.map((f) => f.id) : []);
          }}
          onSelectOne={(id, checked) => {
            setSelectedCacheIds((prev) =>
              checked ? [...prev, id] : prev.filter((x) => x !== id),
            );
          }}
          formatSize={formatSize}
          formatDate={formatDate}
        />

        <footer className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-2">
            <div
              className={`h-1.5 w-1.5 rounded-full ${status === "saved" ? "bg-green-500" : "bg-amber-500"}`}
            />
            <span className="text-[12px] font-medium text-[color-mix(in_srgb,var(--fill-primary)_50%,transparent)]">
              {status === "saved" ? "Changes saved" : "idle"}
            </span>
          </div>
        </footer>
      </div>
    </section>
  );
}
