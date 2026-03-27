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
  annotationColor: string;
};

const DEFAULT_BASE_SETTINGS: BaseSettings = {
  annotationColor: "#8000ff",
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
      annotationColor: getPref("annotationColor") || "#8000ff",
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
    switch (key) {
      case "annotationColor":
        setPref("annotationColor", value as string);
        break;
      default:
        break;
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
    <section className="relative min-h-[320px] rounded-xl border border-[color-mix(in_srgb,var(--accent-blue)_30%,transparent)] bg-[linear-gradient(145deg,color-mix(in_srgb,var(--material-sidepane)_88%,var(--accent-blue)_12%),var(--material-sidepane))] p-5 text-[var(--fill-primary)]">
      {/* 背景装饰 */}
      <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-[color-mix(in_srgb,var(--accent-blue)_20%,transparent)] blur-3xl" />

      <div className="flex flex-col gap-5">
        {/* Header Section */}
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
                  onChange={(event) =>
                    updateBaseSetting("annotationColor", event.target.value)
                  }
                  className="h-9 w-14 cursor-pointer rounded border border-[color-mix(in_srgb,var(--fill-primary)_18%,transparent)] bg-transparent p-1"
                />
                <Input
                  type="text"
                  value={baseSettings.annotationColor}
                  onChange={(event) =>
                    updateBaseSetting("annotationColor", event.target.value)
                  }
                  className="h-9 border-[color-mix(in_srgb,var(--fill-primary)_18%,transparent)] bg-[color-mix(in_srgb,var(--material-sidepane)_84%,var(--fill-primary)_8%)] font-mono text-[var(--fill-primary)]"
                />
              </div>
            </div>
            <Separator className="bg-[color-mix(in_srgb,var(--fill-primary)_14%,transparent)]" />
          </CardContent>
        </Card>

        {/* API Configuration Card */}
        <Card className="border-[color-mix(in_srgb,var(--fill-primary)_16%,transparent)] bg-[color-mix(in_srgb,var(--material-sidepane)_90%,var(--fill-primary)_8%)] p-4 text-[var(--fill-primary)]">
          <CardHeader className="p-0 pb-4">
            <CardTitle className="text-[16px]">AI API Configuration</CardTitle>
          </CardHeader>

          <CardContent className="flex flex-col justify-between gap-4 p-0">
            <div>
              <span className="text-[12px] font-bold uppercase tracking-wider text-[color-mix(in_srgb,var(--fill-primary)_50%,transparent)]">
                Provider
              </span>
              <select
                value={aiSettings.provider}
                onChange={(event) =>
                  changeProvider(event.target.value as AIProvider)
                }
                className="h-9 w-full rounded-md border border-[color-mix(in_srgb,var(--fill-primary)_18%,transparent)] bg-[color-mix(in_srgb,var(--material-sidepane)_84%,var(--fill-primary)_8%)] px-3 text-[14px] outline-none transition focus:border-[var(--accent-blue)]"
              >
                {AI_PROVIDER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <Separator className="bg-[color-mix(in_srgb,var(--fill-primary)_14%,transparent)]" />

            <div className="overflow-hidden">
              <span className="text-[12px] font-bold uppercase tracking-wider text-[color-mix(in_srgb,var(--fill-primary)_50%,transparent)]">
                API Key
              </span>
              <Input
                type="password"
                value={aiSettings.apiKey}
                onChange={(event) =>
                  updateAISetting("apiKey", event.target.value)
                }
                placeholder="OpenRouter API key"
                className="h-9 border-[color-mix(in_srgb,var(--fill-primary)_18%,transparent)] bg-[color-mix(in_srgb,var(--material-sidepane)_84%,var(--fill-primary)_8%)]"
              />
            </div>

            <Separator className="bg-[color-mix(in_srgb,var(--fill-primary)_14%,transparent)]" />

            <div className="overflow-hidden">
              <span className="text-[12px] font-bold uppercase tracking-wider text-[color-mix(in_srgb,var(--fill-primary)_50%,transparent)]">
                Base URL
              </span>
              <Input
                value={aiSettings.baseURL}
                onChange={(event) =>
                  updateAISetting("baseURL", event.target.value)
                }
                placeholder={getDefaultBaseURL(aiSettings.provider)}
                className="h-9 border-[color-mix(in_srgb,var(--fill-primary)_18%,transparent)] bg-[color-mix(in_srgb,var(--material-sidepane)_84%,var(--fill-primary)_8%)]"
              />
            </div>

            <Separator className="bg-[color-mix(in_srgb,var(--fill-primary)_14%,transparent)]" />

            <div className="overflow-hidden">
              <span className="text-[12px] font-bold uppercase tracking-wider text-[color-mix(in_srgb,var(--fill-primary)_50%,transparent)]">
                Model
              </span>
              <Input
                value={aiSettings.model}
                onChange={(event) =>
                  updateAISetting("model", event.target.value)
                }
                placeholder={getDefaultModel(aiSettings.provider)}
                className="h-9 border-[color-mix(in_srgb,var(--fill-primary)_18%,transparent)] bg-[color-mix(in_srgb,var(--material-sidepane)_84%,var(--fill-primary)_8%)]"
              />
            </div>

            <Separator className="bg-[color-mix(in_srgb,var(--fill-primary)_14%,transparent)]" />

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
                onChange={(event) =>
                  updateAISetting(
                    "temperature",
                    parseFloat(event.target.value || "0"),
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
                onChange={(event) =>
                  updateAISetting(
                    "maxTokens",
                    parseInt(event.target.value || "1", 10),
                  )
                }
                className="h-9 border-[color-mix(in_srgb,var(--fill-primary)_18%,transparent)] bg-[color-mix(in_srgb,var(--material-sidepane)_84%,var(--fill-primary)_8%)] font-mono text-[var(--fill-primary)]"
              />
            </div>

            <Separator className="bg-[color-mix(in_srgb,var(--fill-primary)_14%,transparent)]" />

            <div className="overflow-hidden">
              <span className="text-[12px] font-bold uppercase tracking-wider text-[color-mix(in_srgb,var(--fill-primary)_50%,transparent)]">
                System Prompt
              </span>
              <Textarea
                rows={4}
                value={aiSettings.systemPrompt}
                onChange={(event) =>
                  updateAISetting("systemPrompt", event.target.value)
                }
                className="resize-none border-[color-mix(in_srgb,var(--fill-primary)_18%,transparent)] bg-[color-mix(in_srgb,var(--material-sidepane)_84%,var(--fill-primary)_8%)] p-3"
              />
            </div>
          </CardContent>
        </Card>

        {/* Footer Section */}
        <footer className="flex items-center justify-between pt-2">
          <Button
            variant="outline"
            onClick={resetAllAISettings}
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
