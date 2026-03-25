import { useEffect, useRef, useState } from "react";
import { getPref, setPref } from "../../utils/prefs";
import {
  AI_DEFAULTS,
  AI_PROVIDER_OPTIONS,
  getDefaultBaseURL,
  getDefaultModel,
  loadAISettings,
  resetAISettings,
  saveAISetting,
  type AIProvider,
  type AISettings,
} from "../../utils/aiPrefs";

type BaseSettings = {
  enable: boolean;
  input: string;
};

const DEFAULT_BASE_SETTINGS: BaseSettings = {
  enable: true,
  input: "This is input",
};

export function PreferencesPanel() {
  const [baseSettings, setBaseSettings] = useState<BaseSettings>(
    DEFAULT_BASE_SETTINGS,
  );
  const [aiSettings, setAISettings] = useState<AISettings>(AI_DEFAULTS);
  const [status, setStatus] = useState<"idle" | "saved">("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setBaseSettings({
      enable: getPref("enable"),
      input: getPref("input"),
    });
    setAISettings(loadAISettings());
  }, []);

  useEffect(
    () => () => {
      if (timerRef.current) {
        globalThis.clearTimeout(timerRef.current);
      }
    },
    [],
  );

  function markSaved() {
    setStatus("saved");
    if (timerRef.current) {
      globalThis.clearTimeout(timerRef.current);
    }
    timerRef.current = globalThis.setTimeout(() => {
      setStatus("idle");
    }, 1000);
  }

  function updateBaseSetting<K extends keyof BaseSettings>(
    key: K,
    value: BaseSettings[K],
  ) {
    setBaseSettings((current) => ({ ...current, [key]: value }));
    if (key === "enable") {
      setPref("enable", value as boolean);
    } else {
      setPref("input", value as string);
    }
    markSaved();
  }

  function updateAISetting<K extends keyof AISettings>(
    key: K,
    value: AISettings[K],
  ) {
    setAISettings((current) => ({ ...current, [key]: value }));
    saveAISetting(key, value);
    markSaved();
  }

  function changeProvider(provider: AIProvider) {
    const nextBaseURL =
      aiSettings.baseURL.trim() === ""
        ? getDefaultBaseURL(provider)
        : aiSettings.baseURL;
    const nextModel =
      aiSettings.model.trim() === ""
        ? getDefaultModel(provider)
        : aiSettings.model;

    setAISettings((current) => ({
      ...current,
      provider,
      baseURL: nextBaseURL,
      model: nextModel,
    }));
    saveAISetting("provider", provider);
    saveAISetting("baseURL", nextBaseURL);
    saveAISetting("model", nextModel);
    markSaved();
  }

  function resetAllAISettings() {
    resetAISettings();
    setAISettings(loadAISettings());
    markSaved();
  }

  return (
    <section className="relative min-h-[320px] w-[92%] overflow-hidden rounded-xl border border-[color-mix(in_srgb,var(--accent-blue)_30%,transparent)] bg-[linear-gradient(145deg,color-mix(in_srgb,var(--material-sidepane)_88%,var(--accent-blue)_12%),var(--material-sidepane))] p-5 text-[var(--fill-primary)]">
      <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-[color-mix(in_srgb,var(--accent-blue)_20%,transparent)] blur-3xl" />

      <div className="relative flex flex-col gap-5">
        <header className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight">
            InSituAI Preferences
          </h2>
          <p className="text-sm text-white/65">
            Configure provider credentials and model defaults for Item Pane
            chat.
          </p>
        </header>

        <div className="rounded-lg border border-white/10 bg-black/10 p-4">
          <label className="flex cursor-pointer items-center justify-between gap-4">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Enable plugin features</p>
              <p className="text-xs text-white/55">
                Global switch for InSituAI.
              </p>
            </div>
            <input
              type="checkbox"
              className="h-4 w-4 accent-[var(--accent-blue)]"
              checked={baseSettings.enable}
              onChange={(event) =>
                updateBaseSetting("enable", event.target.checked)
              }
            />
          </label>
        </div>

        <div className="rounded-lg border border-white/10 bg-black/10 p-4">
          <label
            htmlFor="insituai-pref-input"
            className="mb-2 block text-sm font-medium"
          >
            Default input text
          </label>
          <input
            id="insituai-pref-input"
            type="text"
            value={baseSettings.input}
            onChange={(event) => updateBaseSetting("input", event.target.value)}
            className="w-full rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm outline-none transition focus:border-[var(--accent-blue)]"
          />
        </div>

        <div className="rounded-lg border border-white/10 bg-black/10 p-4">
          <h3 className="mb-3 text-sm font-semibold tracking-wide text-white/85">
            AI API Configuration
          </h3>

          <div className="grid gap-3">
            <label className="space-y-1.5">
              <span className="block text-xs font-medium uppercase tracking-wide text-white/55">
                Provider
              </span>
              <select
                value={aiSettings.provider}
                onChange={(event) =>
                  changeProvider(event.target.value as AIProvider)
                }
                className="w-full rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm outline-none transition focus:border-[var(--accent-blue)]"
              >
                {AI_PROVIDER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1.5">
              <span className="block text-xs font-medium uppercase tracking-wide text-white/55">
                API Key
              </span>
              <input
                type="password"
                value={aiSettings.apiKey}
                onChange={(event) =>
                  updateAISetting("apiKey", event.target.value)
                }
                placeholder="sk-..."
                className="w-full rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm outline-none transition focus:border-[var(--accent-blue)]"
              />
            </label>

            <label className="space-y-1.5">
              <span className="block text-xs font-medium uppercase tracking-wide text-white/55">
                Base URL
              </span>
              <input
                type="text"
                value={aiSettings.baseURL}
                onChange={(event) =>
                  updateAISetting("baseURL", event.target.value)
                }
                placeholder={getDefaultBaseURL(aiSettings.provider)}
                className="w-full rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm outline-none transition focus:border-[var(--accent-blue)]"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1.5">
                <span className="block text-xs font-medium uppercase tracking-wide text-white/55">
                  Model
                </span>
                <input
                  type="text"
                  value={aiSettings.model}
                  onChange={(event) =>
                    updateAISetting("model", event.target.value)
                  }
                  placeholder={getDefaultModel(aiSettings.provider)}
                  className="w-full rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm outline-none transition focus:border-[var(--accent-blue)]"
                />
              </label>

              <label className="space-y-1.5">
                <span className="block text-xs font-medium uppercase tracking-wide text-white/55">
                  Temperature
                </span>
                <input
                  type="number"
                  min={0}
                  max={2}
                  step={0.1}
                  value={aiSettings.temperature}
                  onChange={(event) =>
                    updateAISetting(
                      "temperature",
                      Number.parseFloat(event.target.value || "0"),
                    )
                  }
                  className="w-full rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm outline-none transition focus:border-[var(--accent-blue)]"
                />
              </label>
            </div>

            <label className="space-y-1.5">
              <span className="block text-xs font-medium uppercase tracking-wide text-white/55">
                Max Tokens
              </span>
              <input
                type="number"
                min={1}
                max={8192}
                step={1}
                value={aiSettings.maxTokens}
                onChange={(event) =>
                  updateAISetting(
                    "maxTokens",
                    Number.parseInt(event.target.value || "1", 10),
                  )
                }
                className="w-full rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm outline-none transition focus:border-[var(--accent-blue)]"
              />
            </label>

            <label className="space-y-1.5">
              <span className="block text-xs font-medium uppercase tracking-wide text-white/55">
                System Prompt
              </span>
              <textarea
                rows={4}
                value={aiSettings.systemPrompt}
                onChange={(event) =>
                  updateAISetting("systemPrompt", event.target.value)
                }
                className="w-full resize-y rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm outline-none transition focus:border-[var(--accent-blue)]"
              />
            </label>
          </div>
        </div>

        <footer className="flex items-center justify-between">
          <button
            type="button"
            onClick={resetAllAISettings}
            className="rounded-md border border-white/15 px-3 py-1.5 text-xs font-medium text-white/80 transition hover:bg-white/10"
          >
            Reset AI defaults
          </button>
          <span className="text-xs text-white/60">
            {status === "saved" ? "Saved" : "Auto-save enabled"}
          </span>
        </footer>
      </div>
    </section>
  );
}
