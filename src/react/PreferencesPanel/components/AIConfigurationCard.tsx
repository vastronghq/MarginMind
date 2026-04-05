import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  AI_PROVIDER_OPTIONS,
  getDefaultBaseURL,
  getDefaultModel,
  type AIPreset,
  type AIProvider,
  type AISettings,
} from "../../../modules/aiPrefs";
import { CustomDropdown } from "./CustomDropdown";

type AIConfigurationCardProps = {
  aiSettings: AISettings;
  presets: AIPreset[];
  activePreset: string;
  showSaveInput: boolean;
  saveName: string;
  onReset: () => void;
  onApplyPreset: (name: string) => void;
  onStartSavePreset: () => void;
  onSavePreset: () => void;
  onDeletePreset: () => void;
  onChangeSaveName: (value: string) => void;
  onCancelSaveInput: () => void;
  onChangeProvider: (provider: AIProvider) => void;
  onChangeAISetting: <K extends keyof AISettings>(
    key: K,
    value: AISettings[K],
  ) => void;
  popupPrompts: {
    explain: string;
    critique: string;
    bulletize: string;
    translate: string;
  };
  onChangePopupPrompt: (
    key: "explain" | "critique" | "bulletize" | "translate",
    value: string,
  ) => void;
};

export function AIConfigurationCard({
  aiSettings,
  presets,
  activePreset,
  showSaveInput,
  saveName,
  onReset,
  onApplyPreset,
  onStartSavePreset,
  onSavePreset,
  onDeletePreset,
  onChangeSaveName,
  onCancelSaveInput,
  onChangeProvider,
  onChangeAISetting,
  popupPrompts,
  onChangePopupPrompt,
}: AIConfigurationCardProps) {
  const presetOptions = [
    { value: "", label: "-- No Preset --" },
    ...presets.map((p) => ({ value: p.name, label: p.name })),
  ];

  return (
    <Card className="border-[color-mix(in_srgb,var(--fill-primary)_16%,transparent)] bg-[color-mix(in_srgb,var(--material-sidepane)_90%,var(--fill-primary)_8%)] p-4 text-[var(--fill-primary)]">
      <CardHeader className="flex flex-row items-center justify-between p-0 pb-4">
        <CardTitle className="text-[16px]">AI Configuration</CardTitle>
        <Button
          variant="outline"
          onClick={onReset}
          className="h-8 border-[color-mix(in_srgb,var(--fill-primary)_18%,transparent)] bg-[color-mix(in_srgb,var(--material-sidepane)_84%,var(--fill-primary)_8%)] px-4 text-[12px] font-medium transition-colors hover:bg-[color-mix(in_srgb,var(--fill-primary)_10%,transparent)]"
        >
          Reset AI defaults
        </Button>
      </CardHeader>

      <CardContent className="flex flex-col justify-between gap-4 p-0">
        <div className="flex w-full flex-col gap-1">
          <span className="text-[12px] font-bold tracking-wider text-[color-mix(in_srgb,var(--fill-primary)_50%,transparent)]">
            Preset
          </span>
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <CustomDropdown
                value={activePreset}
                options={presetOptions}
                onChange={onApplyPreset}
              />
            </div>
            {showSaveInput ? (
              <>
                <Input
                  value={saveName}
                  onChange={(e) => onChangeSaveName(e.target.value)}
                  placeholder="Preset name"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onSavePreset();
                    if (e.key === "Escape") onCancelSaveInput();
                  }}
                  className="h-6 w-48 border-[color-mix(in_srgb,var(--fill-primary)_18%,transparent)] bg-[color-mix(in_srgb,var(--material-sidepane)_84%,var(--fill-primary)_8%)]"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onSavePreset}
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
                  onClick={onStartSavePreset}
                  className="h-8 shrink-0 border-[color-mix(in_srgb,var(--fill-primary)_18%,transparent)] bg-[color-mix(in_srgb,var(--material-sidepane)_84%,var(--fill-primary)_8%)] text-[12px]"
                >
                  Save
                </Button>
                {activePreset ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onDeletePreset}
                    className="h-8 shrink-0 border-[color-mix(in_srgb,_rgb(220_38_38)_30%,transparent)] bg-[color-mix(in_srgb,var(--material-sidepane)_84%,var(--fill-primary)_8%)] text-[12px] text-red-500 hover:text-red-400"
                  >
                    Delete
                  </Button>
                ) : null}
              </>
            )}
          </div>
        </div>

        <Separator className="bg-[color-mix(in_srgb,var(--fill-primary)_14%,transparent)]" />

        <div className="flex w-full flex-col gap-1">
          <span className="text-[12px] font-bold tracking-wider text-[color-mix(in_srgb,var(--fill-primary)_50%,transparent)]">
            Provider
          </span>
          <CustomDropdown
            value={aiSettings.provider}
            options={AI_PROVIDER_OPTIONS.map((o) => ({
              value: o.value,
              label: o.label,
            }))}
            onChange={onChangeProvider}
          />
        </div>

        <div className="flex w-full flex-col gap-1">
          <span className="text-[12px] font-bold tracking-wider text-[color-mix(in_srgb,var(--fill-primary)_50%,transparent)]">
            Base URL
          </span>
          <input
            value={aiSettings.baseURL}
            onChange={(e) => onChangeAISetting("baseURL", e.target.value)}
            placeholder={getDefaultBaseURL(aiSettings.provider)}
            className="h-9 border-[1px] border-[color-mix(in_srgb,var(--fill-primary)_18%,transparent)] bg-[color-mix(in_srgb,var(--material-sidepane)_84%,var(--fill-primary)_8%)]"
          />
        </div>

        <div className="flex w-full flex-col gap-1">
          <span className="text-[12px] font-bold tracking-wider text-[color-mix(in_srgb,var(--fill-primary)_50%,transparent)]">
            API Key
          </span>
          <input
            type="password"
            value={aiSettings.apiKey}
            onChange={(e) => onChangeAISetting("apiKey", e.target.value)}
            placeholder="API key"
            className="h-9 border-[1px] border-[color-mix(in_srgb,var(--fill-primary)_18%,transparent)] bg-[color-mix(in_srgb,var(--material-sidepane)_84%,var(--fill-primary)_8%)]"
          />
        </div>

        <div className="flex w-full flex-col gap-1">
          <span className="text-[12px] font-bold tracking-wider text-[color-mix(in_srgb,var(--fill-primary)_50%,transparent)]">
            Model
          </span>
          <input
            value={aiSettings.model}
            onChange={(e) => onChangeAISetting("model", e.target.value)}
            placeholder={getDefaultModel(aiSettings.provider)}
            className="h-9 border-[1px] border-[color-mix(in_srgb,var(--fill-primary)_18%,transparent)] bg-[color-mix(in_srgb,var(--material-sidepane)_84%,var(--fill-primary)_8%)]"
          />
        </div>

        <div className="flex w-full items-center gap-2">
          <div className="flex flex-1 flex-col gap-1">
            <span className="text-[12px] font-bold tracking-wider text-[color-mix(in_srgb,var(--fill-primary)_50%,transparent)]">
              Temperature
            </span>
            <input
              type="number"
              value={aiSettings.temperature}
              min={0}
              max={2}
              step={0.1}
              onChange={(e) =>
                onChangeAISetting(
                  "temperature",
                  parseFloat(e.target.value || "0"),
                )
              }
              className="h-9 border-[color-mix(in_srgb,var(--fill-primary)_18%,transparent)] bg-[color-mix(in_srgb,var(--material-sidepane)_84%,var(--fill-primary)_8%)] font-mono text-[var(--fill-primary)]"
            />
          </div>

          <div className="flex flex-1 flex-col gap-1">
            <span className="text-[12px] font-bold tracking-wider text-[color-mix(in_srgb,var(--fill-primary)_50%,transparent)]">
              Max Tokens
            </span>
            <input
              type="number"
              value={aiSettings.maxTokens}
              onChange={(e) =>
                onChangeAISetting(
                  "maxTokens",
                  parseInt(e.target.value || "1", 10),
                )
              }
              className="h-9 border-[color-mix(in_srgb,var(--fill-primary)_18%,transparent)] bg-[color-mix(in_srgb,var(--material-sidepane)_84%,var(--fill-primary)_8%)] font-mono text-[var(--fill-primary)]"
            />
          </div>
        </div>

        <Separator className="bg-[color-mix(in_srgb,var(--fill-primary)_14%,transparent)]" />

        <div className="flex flex-col gap-4">
          <div className="flex w-full flex-col gap-1">
            <span className="text-[12px] font-bold tracking-wider text-[color-mix(in_srgb,var(--fill-primary)_50%,transparent)]">
              System Prompt
            </span>
            <textarea
              rows={3}
              value={aiSettings.systemPrompt}
              onChange={(e) =>
                onChangeAISetting("systemPrompt", e.target.value)
              }
              className="resize-none border-[color-mix(in_srgb,var(--fill-primary)_18%,transparent)] bg-[color-mix(in_srgb,var(--material-sidepane)_84%,var(--fill-primary)_8%)] p-3"
            />
          </div>

          <Separator className="bg-[color-mix(in_srgb,var(--fill-primary)_14%,transparent)]" />

          <div className="flex w-full flex-col gap-1">
            <span className="text-[12px] font-bold tracking-wider text-[color-mix(in_srgb,var(--fill-primary)_50%,transparent)]">
              Explain Prompt
            </span>
            <textarea
              rows={3}
              value={popupPrompts.explain}
              onChange={(e) => onChangePopupPrompt("explain", e.target.value)}
              className="resize-none border-[color-mix(in_srgb,var(--fill-primary)_18%,transparent)] bg-[color-mix(in_srgb,var(--material-sidepane)_84%,var(--fill-primary)_8%)] p-3"
            />
          </div>

          <div className="flex w-full flex-col gap-1">
            <span className="text-[12px] font-bold tracking-wider text-[color-mix(in_srgb,var(--fill-primary)_50%,transparent)]">
              Critique Prompt
            </span>
            <textarea
              rows={3}
              value={popupPrompts.critique}
              onChange={(e) => onChangePopupPrompt("critique", e.target.value)}
              className="resize-none border-[color-mix(in_srgb,var(--fill-primary)_18%,transparent)] bg-[color-mix(in_srgb,var(--material-sidepane)_84%,var(--fill-primary)_8%)] p-3"
            />
          </div>

          <div className="flex w-full flex-col gap-1">
            <span className="text-[12px] font-bold tracking-wider text-[color-mix(in_srgb,var(--fill-primary)_50%,transparent)]">
              Bulletize Prompt
            </span>
            <textarea
              rows={3}
              value={popupPrompts.bulletize}
              onChange={(e) => onChangePopupPrompt("bulletize", e.target.value)}
              className="resize-none border-[color-mix(in_srgb,var(--fill-primary)_18%,transparent)] bg-[color-mix(in_srgb,var(--material-sidepane)_84%,var(--fill-primary)_8%)] p-3"
            />
          </div>

          <div className="flex w-full flex-col gap-1">
            <span className="text-[12px] font-bold tracking-wider text-[color-mix(in_srgb,var(--fill-primary)_50%,transparent)]">
              Translate Prompt
            </span>
            <textarea
              rows={3}
              value={popupPrompts.translate}
              onChange={(e) => onChangePopupPrompt("translate", e.target.value)}
              className="resize-none border-[color-mix(in_srgb,var(--fill-primary)_18%,transparent)] bg-[color-mix(in_srgb,var(--material-sidepane)_84%,var(--fill-primary)_8%)] p-3"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
