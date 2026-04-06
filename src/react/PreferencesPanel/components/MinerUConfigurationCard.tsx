import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { CacheFileItem } from "../types";

type MinerUConfigurationCardProps = {
  mineruApiKey: string;
  cacheFiles: CacheFileItem[];
  selectedCacheIds: string[];
  onChangeApiKey: (value: string) => void;
  onRefresh: () => Promise<void>;
  onDeleteSelected: () => Promise<void>;
  onSelectAll: (checked: boolean) => void;
  onSelectOne: (id: string, checked: boolean) => void;
  formatSize: (bytes: number) => string;
  formatDate: (date: Date) => string;
};

export function MinerUConfigurationCard({
  mineruApiKey,
  cacheFiles,
  selectedCacheIds,
  onChangeApiKey,
  onRefresh,
  onDeleteSelected,
  onSelectAll,
  onSelectOne,
  formatSize,
  formatDate,
}: MinerUConfigurationCardProps) {
  return (
    <Card className="border-[color-mix(in_srgb,var(--fill-primary)_16%,transparent)] bg-[color-mix(in_srgb,var(--material-sidepane)_90%,var(--fill-primary)_8%)] p-4 text-[var(--fill-primary)]">
      <CardHeader className="p-0 pb-4">
        <CardTitle className="text-[16px]">MinerU Configuration</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col justify-between gap-4 p-0">
        <div className="flex w-full flex-col">
          <span className="text-[12px] font-bold tracking-wider text-[color-mix(in_srgb,var(--fill-primary)_50%,transparent)]">
            API Key{" "}
          </span>
          <div className="mt-1 text-[11px] font-normal text-[color-mix(in_srgb,var(--fill-primary)_50%,transparent)]">
            get it from{" "}
            <a
              className="text-[var(--accent-blue)] hover:underline"
              onClick={(e) => {
                e.preventDefault();
                Zotero.launchURL("https://mineru.net/apiManage/token");
              }}
            >
              MinerU
            </a>{" "}
            and use it for free
          </div>

          <input
            type="password"
            value={mineruApiKey}
            onChange={(e) => onChangeApiKey(e.target.value)}
            placeholder="Paste your MinerU API key here"
            className="h-9 border-[1px] border-[color-mix(in_srgb,var(--fill-primary)_18%,transparent)] bg-[color-mix(in_srgb,var(--material-sidepane)_84%,var(--fill-primary)_8%)]"
          />
        </div>

        <Separator className="bg-[color-mix(in_srgb,var(--fill-primary)_14%,transparent)]" />

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-bold tracking-wider text-[color-mix(in_srgb,var(--fill-primary)_50%,transparent)]">
              Markdown Cache ({cacheFiles.length} files)
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void onRefresh()}
                className="h-7 border-[color-mix(in_srgb,var(--fill-primary)_18%,transparent)] bg-[color-mix(in_srgb,var(--material-sidepane)_84%,var(--fill-primary)_8%)] text-[11px]"
              >
                Refresh
              </Button>
              {selectedCacheIds.length > 0 ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void onDeleteSelected()}
                  className="h-7 border-[color-mix(in_srgb,_rgb(220_38_38)_30%,transparent)] text-[11px] text-red-500 hover:text-red-400"
                >
                  Delete ({selectedCacheIds.length})
                </Button>
              ) : null}
            </div>
          </div>

          {cacheFiles.length > 0 ? (
            <div className="max-h-96 overflow-y-auto rounded-md border border-[color-mix(in_srgb,var(--fill-primary)_18%,transparent)]">
              <table className="w-full text-[12px]">
                <thead className="sticky top-0 bg-[color-mix(in_srgb,var(--material-sidepane)_95%,var(--fill-primary)_5%)]">
                  <tr>
                    <th className="w-8 p-2">
                      <input
                        type="checkbox"
                        checked={selectedCacheIds.length === cacheFiles.length}
                        onChange={(e) => onSelectAll(e.target.checked)}
                        className="cursor-pointer"
                      />
                    </th>
                    <th className="p-2 text-left">Name</th>
                    <th className="w-20 p-2 text-right">Size</th>
                    <th className="w-32 p-2 text-right">Modified</th>
                  </tr>
                </thead>
                <tbody>
                  {cacheFiles.map((file) => (
                    <tr
                      key={file.id}
                      className="border-t border-[color-mix(in_srgb,var(--fill-primary)_10%,transparent)]"
                    >
                      <td className="p-2">
                        <input
                          id={`checkbox-${file.id}`}
                          type="checkbox"
                          checked={selectedCacheIds.includes(file.id)}
                          onChange={(e) =>
                            onSelectOne(file.id, e.target.checked)
                          }
                          className="cursor-pointer"
                        />
                      </td>
                      <td className="p-0" title={file.name}>
                        <label
                          htmlFor={`checkbox-${file.id}`}
                          className="block w-full cursor-pointer p-2"
                        >
                          {file.name}
                        </label>
                      </td>
                      <td className="p-2 text-right text-[color-mix(in_srgb,var(--fill-primary)_60%,transparent)]">
                        {formatSize(file.size)}
                      </td>
                      <td className="p-2 text-right text-[color-mix(in_srgb,var(--fill-primary)_60%,transparent)]">
                        {formatDate(file.modified)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-md border border-[color-mix(in_srgb,var(--fill-primary)_18%,transparent)] p-4 text-center text-[12px] text-[color-mix(in_srgb,var(--fill-primary)_50%,transparent)]">
              No cached markdown files
            </div>
          )}
        </div>

        <Separator className="bg-[color-mix(in_srgb,var(--fill-primary)_14%,transparent)]" />
      </CardContent>
    </Card>
  );
}
