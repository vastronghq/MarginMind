import { useCallback, useEffect, useRef, useState } from "react";
import { getPref, setPref } from "../../utils/prefs";
import {
  AI_DEFAULTS,
  AI_PROVIDER_OPTIONS,
  getDefaultBaseURL,
  getDefaultModel,
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

type BaseSettings = {
  annotationColor: string;
};

const DEFAULT_BASE_SETTINGS: BaseSettings = {
  annotationColor: "#8000ff",
};

/* ── Reusable custom dropdown ─────────────────────────────────────────── */

function CustomDropdown<T extends string>(props: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
}) {
  const { value, options, onChange } = props;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    }
    document.addEventListener("mousedown", handle, true);
    return () => document.removeEventListener("mousedown", handle, true);
  }, [open]);

  const current = options.find((o) => o.value === value);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-full items-center justify-between rounded-md border border-[color-mix(in_srgb,var(--fill-primary)_18%,transparent)] bg-[color-mix(in_srgb,var(--material-sidepane)_84%,var(--fill-primary)_8%)] px-3 text-left text-[14px] outline-none transition focus:border-[var(--accent-blue)]"
      >
        <span>{current?.label ?? value}</span>
        <Chevron open={open} />
      </button>
      {open && (
        <div
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-hidden overflow-y-auto rounded-md border border-[color-mix(in_srgb,var(--fill-primary)_18%,transparent)] bg-[var(--material-sidepane)] shadow-lg"
          onMouseDown={(e) => e.preventDefault()}
        >
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
              className={`flex w-full items-center justify-start px-3 py-2 text-left text-[13px] transition-colors hover:bg-[color-mix(in_srgb,var(--accent-blue)_15%,transparent)] ${
                o.value === value
                  ? "bg-[color-mix(in_srgb,var(--accent-blue)_10%,transparent)] font-medium"
                  : ""
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
    >
      <path
        d="M3 4.5L6 7.5L9 4.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ── Main panel ───────────────────────────────────────────────────────── */

export function PreferencesPanel() {
  const [baseSettings, setBaseSettings] = useState<BaseSettings>(
    DEFAULT_BASE_SETTINGS,
  );
  const [aiSettings, setAISettings] = useState<AISettings>(AI_DEFAULTS);
  const [status, setStatus] = useState<"idle" | "saved">("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Preset state
  const [presets, setPresets] = useState<AIPreset[]>([]);
  const [activePreset, setActivePreset] = useState<string>("");
  const [saveName, setSaveName] = useState("");
  const [showSaveInput, setShowSaveInput] = useState(false);

  // ── Load on mount ──────────────────────────────────────────────────
  useEffect(() => {
    setBaseSettings({
      annotationColor: getPref("annotationColor") || "#8000ff",
    });
    setAISettings(loadAISettings());
    setPresets(loadPresets());
  }, []);

  useEffect(
    () => () => {
      if (timerRef.current) globalThis.clearTimeout(timerRef.current);
    },
    [],
  );

  // ── Helpers ────────────────────────────────────────────────────────
  const markSaved = useCallback(() => {
    setStatus("saved");
    if (timerRef.current) globalThis.clearTimeout(timerRef.current);
    timerRef.current = globalThis.setTimeout(() => setStatus("idle"), 1000);
  }, []);

  function updateBaseSetting<K extends keyof BaseSettings>(
    key: K,
    value: BaseSettings[K],
  ) {
    setBaseSettings((c) => ({ ...c, [key]: value }));
    if (key === "annotationColor") setPref("annotationColor", value as string);
    markSaved();
  }

  function updateAISetting<K extends keyof AISettings>(
    key: K,
    value: AISettings[K],
  ) {
    setAISettings((c) => ({ ...c, [key]: value }));
    saveAISetting(key, value);
    setActivePreset("");
    markSaved();
  }

  function changeProvider(provider: AIProvider) {
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
  }

  function resetAll() {
    resetAISettings();
    setAISettings(loadAISettings());
    setActivePreset("");
    markSaved();
  }

  // ── Preset actions ─────────────────────────────────────────────────
  function handleApplyPreset(name: string) {
    setActivePreset(name);
    const preset = presets.find((p) => p.name === name);
    if (!preset) return;
    applyPreset(preset);
    setAISettings(loadAISettings());
    markSaved();
  }

  function handleSavePreset() {
    const name = saveName.trim();
    if (!name) return;
    savePreset(name, aiSettings);
    setPresets(loadPresets());
    setActivePreset(name);
    setSaveName("");
    setShowSaveInput(false);
    markSaved();
  }

  function handleDeletePreset() {
    if (!activePreset) return;
    deletePreset(activePreset);
    setPresets(loadPresets());
    setActivePreset("");
    markSaved();
  }

  const presetOptions = [
    { value: "", label: "-- No Preset --" },
    ...presets.map((p) => ({ value: p.name, label: p.name })),
  ];

  return (
    <section className="relative min-h-[320px] rounded-xl border border-[color-mix(in_srgb,var(--accent-blue)_30%,transparent)] bg-[linear-gradient(145deg,color-mix(in_srgb,var(--material-sidepane)_88%,var(--accent-blue)_12%),var(--material-sidepane))] p-5 text-[var(--fill-primary)]">
      <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-[color-mix(in_srgb,var(--accent-blue)_20%,transparent)] blur-3xl" />

      <div className="flex flex-col gap-5">
        {/* Header */}
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

        {/* General Card */}
        <Card className="border-[color-mix(in_srgb,var(--fill-primary)_16%,transparent)] bg-[color-mix(in_srgb,var(--material-sidepane)_90%,var(--fill-primary)_8%)] p-4 text-[var(--fill-primary)]">
          <CardHeader className="p-0 pb-4">
            <CardTitle className="text-[16px]">General</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col justify-between gap-4 p-0">
            <div>
              <span className="text-[12px] font-bold uppercase tracking-wider text-[color-mix(in_srgb,var(--fill-primary)_50%,transparent)]">
                Annotation Color
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={baseSettings.annotationColor}
                  onChange={(e) =>
                    updateBaseSetting("annotationColor", e.target.value)
                  }
                  className="h-9 w-14 cursor-pointer rounded border border-[color-mix(in_srgb,var(--fill-primary)_18%,transparent)] bg-transparent p-1"
                />
                <Input
                  type="text"
                  value={baseSettings.annotationColor}
                  onChange={(e) =>
                    updateBaseSetting("annotationColor", e.target.value)
                  }
                  className="h-9 border-[color-mix(in_srgb,var(--fill-primary)_18%,transparent)] bg-[color-mix(in_srgb,var(--material-sidepane)_84%,var(--fill-primary)_8%)] font-mono text-[var(--fill-primary)]"
                />
              </div>
            </div>
            <Separator className="bg-[color-mix(in_srgb,var(--fill-primary)_14%,transparent)]" />
          </CardContent>
        </Card>

        {/* AI API Configuration Card */}
        <Card className="border-[color-mix(in_srgb,var(--fill-primary)_16%,transparent)] bg-[color-mix(in_srgb,var(--material-sidepane)_90%,var(--fill-primary)_8%)] p-4 text-[var(--fill-primary)]">
          <CardHeader className="p-0 pb-4">
            <CardTitle className="text-[16px]">AI API Configuration</CardTitle>
          </CardHeader>

          <CardContent className="flex flex-col justify-between gap-4 p-0">
            {/* ── Preset selector ──────────────────────────────────── */}
            <div>
              <span className="text-[12px] font-bold uppercase tracking-wider text-[color-mix(in_srgb,var(--fill-primary)_50%,transparent)]">
                Preset
              </span>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <CustomDropdown
                    value={activePreset}
                    options={presetOptions}
                    onChange={handleApplyPreset}
                  />
                </div>
                {showSaveInput ? (
                  <>
                    <Input
                      value={saveName}
                      onChange={(e) => setSaveName(e.target.value)}
                      placeholder="Preset name"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSavePreset();
                        if (e.key === "Escape") setShowSaveInput(false);
                      }}
                      className="h-9 w-36 border-[color-mix(in_srgb,var(--fill-primary)_18%,transparent)] bg-[color-mix(in_srgb,var(--material-sidepane)_84%,var(--fill-primary)_8%)]"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSavePreset}
                      className="h-8 shrink-0 border-[color-mix(in_srgb,var(--fill-primary)_18%,transparent)] bg-[color-mix(in_srgb,var(--material-sidepane)_84%,var(--fill-primary)_8%)] text-[12px]"
                    >
                      Save
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSaveName(activePreset || "");
                        setShowSaveInput(true);
                      }}
                      className="h-8 shrink-0 border-[color-mix(in_srgb,var(--fill-primary)_18%,transparent)] bg-[color-mix(in_srgb,var(--material-sidepane)_84%,var(--fill-primary)_8%)] text-[12px]"
                    >
                      Save
                    </Button>
                    {activePreset && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDeletePreset}
                        className="h-8 shrink-0 border-[color-mix(in_srgb,_rgb(220_38_38)_30%,transparent)] bg-[color-mix(in_srgb,var(--material-sidepane)_84%,var(--fill-primary)_8%)] text-[12px] text-red-500 hover:text-red-400"
                      >
                        Delete
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>

            <Separator className="bg-[color-mix(in_srgb,var(--fill-primary)_14%,transparent)]" />

            {/* ── Provider ─────────────────────────────────────────── */}
            <div>
              <span className="text-[12px] font-bold uppercase tracking-wider text-[color-mix(in_srgb,var(--fill-primary)_50%,transparent)]">
                Provider
              </span>
              <CustomDropdown
                value={aiSettings.provider}
                options={AI_PROVIDER_OPTIONS.map((o) => ({
                  value: o.value,
                  label: o.label,
                }))}
                onChange={changeProvider}
              />
            </div>

            <Separator className="bg-[color-mix(in_srgb,var(--fill-primary)_14%,transparent)]" />

            {/* ── API Key ──────────────────────────────────────────── */}
            <div className="overflow-hidden">
              <span className="text-[12px] font-bold uppercase tracking-wider text-[color-mix(in_srgb,var(--fill-primary)_50%,transparent)]">
                API Key
              </span>
              <Input
                type="password"
                value={aiSettings.apiKey}
                onChange={(e) => updateAISetting("apiKey", e.target.value)}
                placeholder="API key"
                className="h-9 border-[color-mix(in_srgb,var(--fill-primary)_18%,transparent)] bg-[color-mix(in_srgb,var(--material-sidepane)_84%,var(--fill-primary)_8%)]"
              />
            </div>

            <Separator className="bg-[color-mix(in_srgb,var(--fill-primary)_14%,transparent)]" />

            {/* ── Base URL ─────────────────────────────────────────── */}
            <div className="overflow-hidden">
              <span className="text-[12px] font-bold uppercase tracking-wider text-[color-mix(in_srgb,var(--fill-primary)_50%,transparent)]">
                Base URL
              </span>
              <Input
                value={aiSettings.baseURL}
                onChange={(e) => updateAISetting("baseURL", e.target.value)}
                placeholder={getDefaultBaseURL(aiSettings.provider)}
                className="h-9 border-[color-mix(in_srgb,var(--fill-primary)_18%,transparent)] bg-[color-mix(in_srgb,var(--material-sidepane)_84%,var(--fill-primary)_8%)]"
              />
            </div>

            <Separator className="bg-[color-mix(in_srgb,var(--fill-primary)_14%,transparent)]" />

            {/* ── Model ────────────────────────────────────────────── */}
            <div className="overflow-hidden">
              <span className="text-[12px] font-bold uppercase tracking-wider text-[color-mix(in_srgb,var(--fill-primary)_50%,transparent)]">
                Model
              </span>
              <Input
                value={aiSettings.model}
                onChange={(e) => updateAISetting("model", e.target.value)}
                placeholder={getDefaultModel(aiSettings.provider)}
                className="h-9 border-[color-mix(in_srgb,var(--fill-primary)_18%,transparent)] bg-[color-mix(in_srgb,var(--material-sidepane)_84%,var(--fill-primary)_8%)]"
              />
            </div>

            <Separator className="bg-[color-mix(in_srgb,var(--fill-primary)_14%,transparent)]" />

            {/* ── Temperature / Max Tokens ─────────────────────────── */}
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-bold uppercase tracking-wider text-[color-mix(in_srgb,var(--fill-primary)_50%,transparent)]">
                Temperature
              </span>
              <Input
                type="number"
                value={aiSettings.temperature}
                min={0}
                max={2}
                step={0.1}
                onChange={(e) =>
                  updateAISetting(
                    "temperature",
                    parseFloat(e.target.value || "0"),
                  )
                }
                className="h-9 border-[color-mix(in_srgb,var(--fill-primary)_18%,transparent)] bg-[color-mix(in_srgb,var(--material-sidepane)_84%,var(--fill-primary)_8%)] font-mono text-[var(--fill-primary)]"
              />
              <span className="text-[12px] font-bold uppercase tracking-wider text-[color-mix(in_srgb,var(--fill-primary)_50%,transparent)]">
                Max Tokens
              </span>
              <Input
                type="number"
                value={aiSettings.maxTokens}
                onChange={(e) =>
                  updateAISetting(
                    "maxTokens",
                    parseInt(e.target.value || "1", 10),
                  )
                }
                className="h-9 border-[color-mix(in_srgb,var(--fill-primary)_18%,transparent)] bg-[color-mix(in_srgb,var(--material-sidepane)_84%,var(--fill-primary)_8%)] font-mono text-[var(--fill-primary)]"
              />
            </div>

            <Separator className="bg-[color-mix(in_srgb,var(--fill-primary)_14%,transparent)]" />

            {/* ── System Prompt ────────────────────────────────────── */}
            <div className="overflow-hidden">
              <span className="text-[12px] font-bold uppercase tracking-wider text-[color-mix(in_srgb,var(--fill-primary)_50%,transparent)]">
                System Prompt
              </span>
              <Textarea
                rows={4}
                value={aiSettings.systemPrompt}
                onChange={(e) =>
                  updateAISetting("systemPrompt", e.target.value)
                }
                className="resize-none border-[color-mix(in_srgb,var(--fill-primary)_18%,transparent)] bg-[color-mix(in_srgb,var(--material-sidepane)_84%,var(--fill-primary)_8%)] p-3"
              />
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <footer className="flex items-center justify-between pt-2">
          <Button
            variant="outline"
            onClick={resetAll}
            className="h-8 border-[color-mix(in_srgb,var(--fill-primary)_18%,transparent)] bg-[color-mix(in_srgb,var(--material-sidepane)_84%,var(--fill-primary)_8%)] px-4 text-[12px] font-medium transition-colors hover:bg-[color-mix(in_srgb,var(--fill-primary)_10%,transparent)]"
          >
            Reset AI defaults
          </Button>
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
