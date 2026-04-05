import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CustomDropdown } from "./CustomDropdown";
import type { BaseSettings } from "../types";

type FontSizeOption = { value: string; label: string };

type GeneralSettingsCardProps = {
  baseSettings: BaseSettings;
  fontSizeOptions: readonly FontSizeOption[];
  onChangeBaseSetting: <K extends keyof BaseSettings>(
    key: K,
    value: BaseSettings[K],
  ) => void;
};

export function GeneralSettingsCard({
  baseSettings,
  fontSizeOptions,
  onChangeBaseSetting,
}: GeneralSettingsCardProps) {
  return (
    <Card className="border-[color-mix(in_srgb,var(--fill-primary)_16%,transparent)] bg-[color-mix(in_srgb,var(--material-sidepane)_90%,var(--fill-primary)_8%)] p-4 text-[var(--fill-primary)]">
      <CardHeader className="p-0 pb-4">
        <CardTitle className="text-[16px]">General</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col justify-between gap-4 p-0">
        <div className="flex w-full items-center gap-2">
          <div className="flex flex-1 flex-col">
            <span className="text-[12px] font-bold tracking-wider text-[color-mix(in_srgb,var(--fill-primary)_50%,transparent)]">
              Annotation Color
            </span>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={baseSettings.annotationColor}
                onChange={(e) =>
                  onChangeBaseSetting("annotationColor", e.target.value)
                }
                className="w-18 h-9 cursor-pointer rounded border border-[color-mix(in_srgb,var(--fill-primary)_18%,transparent)] bg-transparent p-1"
              />
              <input
                type="text"
                value={baseSettings.annotationColor}
                onChange={(e) =>
                  onChangeBaseSetting("annotationColor", e.target.value)
                }
                className="h-9 flex-1 border-[color-mix(in_srgb,var(--fill-primary)_18%,transparent)] bg-[color-mix(in_srgb,var(--material-sidepane)_84%,var(--fill-primary)_8%)] font-mono text-[var(--fill-primary)]"
              />
            </div>
          </div>
          <div className="flex flex-1 flex-col">
            <span className="text-[12px] font-bold tracking-wider text-[color-mix(in_srgb,var(--fill-primary)_50%,transparent)]">
              Markdown Font Size
            </span>
            <div className="flex-1 items-center gap-2">
              <CustomDropdown
                value={baseSettings.markdownFontSize}
                options={fontSizeOptions as FontSizeOption[]}
                onChange={(v) => onChangeBaseSetting("markdownFontSize", v)}
              />
            </div>
          </div>
        </div>
        <Separator className="bg-[color-mix(in_srgb,var(--fill-primary)_14%,transparent)]" />
      </CardContent>
    </Card>
  );
}
