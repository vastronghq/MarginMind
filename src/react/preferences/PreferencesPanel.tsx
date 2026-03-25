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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

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
    <section className="relative min-h-[320px] w-[92%] overflow-hidden rounded-xl border border-[color-mix(in_srgb,var(--accent-blue)_30%,transparent)] bg-[linear-gradient(145deg,color-mix(in_srgb,var(--material-sidepane)_88%,var(--accent-blue)_12%),var(--material-sidepane))] p-4 text-[var(--fill-primary)]">
      <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-[color-mix(in_srgb,var(--accent-blue)_20%,transparent)] blur-3xl" />

      <div className="relative flex flex-col gap-4">
        <header className="space-y-1.5">
          <h2 className="text-[22px] font-semibold tracking-tight">InSituAI Preferences</h2>
          <p className="text-[14px] text-white/65">
            Configure OpenRouter + model routing for Item Pane streaming chat.
          </p>
          <Badge variant="outline" className="border-white/10 px-1.5 py-0 text-[12px] text-white/65">
            {status === "saved" ? "Saved" : "Auto-save enabled"}
          </Badge>
        </header>

        <Card className="border-white/10 bg-black/10 text-[var(--fill-primary)]">
          <CardHeader className="pb-2.5">
            <CardTitle className="text-[16px]">General</CardTitle>
            <CardDescription className="text-[13px] text-white/55">
              Basic plugin controls.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <label className="flex cursor-pointer items-center justify-between gap-4">
              <div className="space-y-0.5">
                <p className="text-[14px] font-medium">Enable plugin features</p>
                <p className="text-[13px] text-white/55">Global switch for InSituAI.</p>
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

            <Separator className="bg-white/10" />

            <div className="space-y-1.5">
              <label htmlFor="insituai-pref-input" className="block text-[14px] font-medium">
                Default input text
              </label>
              <Input
                id="insituai-pref-input"
                type="text"
                value={baseSettings.input}
                onChange={(event) =>
                  updateBaseSetting("input", event.target.value)
                }
                className="border-white/15 bg-black/20 text-[var(--fill-primary)]"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-black/10 text-[var(--fill-primary)]">
          <CardHeader className="pb-2.5">
            <CardTitle className="text-[16px]">AI API Configuration</CardTitle>
            <CardDescription className="text-[13px] text-white/55">
              These values are used by the item pane assistant.
            </CardDescription>
          </CardHeader>

          <CardContent className="grid gap-2.5">
            <label className="space-y-1.5">
              <span className="block text-[12px] font-medium uppercase tracking-wide text-white/55">
                Provider
              </span>
              <select
                value={aiSettings.provider}
                onChange={(event) =>
                  changeProvider(event.target.value as AIProvider)
                }
                className="h-8 w-full rounded-md border border-white/15 bg-black/20 px-2.5 py-1 text-[14px] text-[var(--fill-primary)] outline-none transition focus:border-[var(--accent-blue)]"
              >
                {AI_PROVIDER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1.5">
              <span className="block text-[12px] font-medium uppercase tracking-wide text-white/55">
                API Key
              </span>
              <Input
                type="password"
                value={aiSettings.apiKey}
                onChange={(event) => updateAISetting("apiKey", event.target.value)}
                placeholder="OpenRouter API key"
                className="border-white/15 bg-black/20 text-[var(--fill-primary)]"
              />
            </label>

            <label className="space-y-1.5">
              <span className="block text-[12px] font-medium uppercase tracking-wide text-white/55">
                Base URL
              </span>
              <Input
                type="text"
                value={aiSettings.baseURL}
                onChange={(event) => updateAISetting("baseURL", event.target.value)}
                placeholder={getDefaultBaseURL(aiSettings.provider)}
                className="border-white/15 bg-black/20 text-[var(--fill-primary)]"
              />
            </label>

            <div className="grid grid-cols-2 gap-2.5">
              <label className="space-y-1.5">
                <span className="block text-[12px] font-medium uppercase tracking-wide text-white/55">
                  Model
                </span>
                <Input
                  type="text"
                  value={aiSettings.model}
                  onChange={(event) => updateAISetting("model", event.target.value)}
                  placeholder={getDefaultModel(aiSettings.provider)}
                  className="border-white/15 bg-black/20 text-[var(--fill-primary)]"
                />
              </label>

              <label className="space-y-1.5">
                <span className="block text-[12px] font-medium uppercase tracking-wide text-white/55">
                  Temperature
                </span>
                <Input
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
                  className="border-white/15 bg-black/20 text-[var(--fill-primary)]"
                />
              </label>
            </div>

            <label className="space-y-1.5">
              <span className="block text-[12px] font-medium uppercase tracking-wide text-white/55">
                Max Tokens
              </span>
              <Input
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
                className="border-white/15 bg-black/20 text-[var(--fill-primary)]"
              />
            </label>

            <label className="space-y-1.5">
              <span className="block text-[12px] font-medium uppercase tracking-wide text-white/55">
                System Prompt
              </span>
              <Textarea
                rows={4}
                value={aiSettings.systemPrompt}
                onChange={(event) =>
                  updateAISetting("systemPrompt", event.target.value)
                }
                className="resize-y border-white/15 bg-black/20 text-[var(--fill-primary)]"
              />
            </label>
          </CardContent>
        </Card>

        <footer className="flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={resetAllAISettings}
            className="h-8 border-white/15 bg-black/20 px-2.5 text-[13px] text-white/80 hover:bg-white/10"
          >
            Reset AI defaults
          </Button>
          <span className="text-[13px] text-white/60">
            {status === "saved" ? "Saved" : "Auto-save enabled"}
          </span>
        </footer>
      </div>
    </section>
  );
}
