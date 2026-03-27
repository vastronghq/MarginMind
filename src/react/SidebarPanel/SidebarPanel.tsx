import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { SidebarPanelData } from "../bridge";

type SidebarPanelProps = {
  data: SidebarPanelData | null;
};

type SidebarWindow = Window & {
  ZoteroPane?: _ZoteroTypes.ZoteroPane;
};

export function SidebarPanel({ data }: SidebarPanelProps) {
  const win = globalThis as unknown as SidebarWindow;

  return (
    <section className="flex h-full min-h-0 flex-col gap-3 bg-[var(--material-sidepane)] p-3 text-[var(--fill-primary)]">
      <Card className="border-[color-mix(in_srgb,var(--fill-primary)_16%,transparent)] bg-[color-mix(in_srgb,var(--material-sidepane)_92%,var(--fill-primary)_8%)]">
        <CardHeader className="pb-2">
          <CardTitle className="text-[15px]">MarginMind Sidebar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-[13px]">
          {data ? (
            <>
              <div className="font-semibold">{data.title}</div>
              <div className="text-[color-mix(in_srgb,var(--fill-primary)_58%,transparent)]">
                {data.creators} | {data.year} | {data.itemType}
              </div>
              <p className="line-clamp-5 text-[color-mix(in_srgb,var(--fill-primary)_66%,transparent)]">
                {data.abstractPreview}
              </p>
            </>
          ) : (
            <div className="text-[color-mix(in_srgb,var(--fill-primary)_58%,transparent)]">
              暂未选中条目，请先在中间文献列表中选择一个条目。
            </div>
          )}
        </CardContent>
      </Card>

      <Separator className="bg-[color-mix(in_srgb,var(--fill-primary)_12%,transparent)]" />

      <Card className="border-[color-mix(in_srgb,var(--fill-primary)_16%,transparent)] bg-[color-mix(in_srgb,var(--material-sidepane)_92%,var(--fill-primary)_8%)]">
        <CardHeader className="pb-2">
          <CardTitle className="text-[14px]">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button
            size="xs"
            variant="outline"
            disabled={!data?.itemID}
            onClick={() => {
              if (data?.itemID) {
                win.ZoteroPane?.selectItem(data.itemID);
              }
            }}
          >
            定位条目
          </Button>
          <Button
            size="xs"
            variant="outline"
            onClick={() => {
              void win.ZoteroPane?.newNote();
            }}
          >
            新建笔记
          </Button>
        </CardContent>
      </Card>
    </section>
  );
}
