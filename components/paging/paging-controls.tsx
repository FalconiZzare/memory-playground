"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, Plus, RotateCcw, Table2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { DemoCaptionBar } from "@/components/dashboard/demo-caption";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { internalFragKB, pagesNeeded, totalInternalFragKB } from "@/engine/paging";
import { StatBar, StatCell } from "@/components/dashboard/stat-bar";
import { usePagingStore } from "@/store/pagingStore";

function PagingStats() {
  const state = usePagingStore((s) => s.state);
  const failed = usePagingStore((s) => s.failedRequests);
  const freeFrames = state.frames.filter((f) => f === null).length;
  const internal = totalInternalFragKB(state);

  return (
    <StatBar>
      <StatCell
        label="Free"
        value={freeFrames}
        unit={`/ ${state.frames.length}`}
      />
      <StatCell
        label="Int. frag"
        value={internal}
        unit="KB"
        tone={internal > 0 ? "warn" : "default"}
      />
      <StatCell
        label="Ext. frag"
        value={
          <span className="inline-flex items-center gap-1">
            0% <Check className="size-3" />
          </span>
        }
        tone="good"
      />
      <StatCell
        label="Failed"
        value={failed}
        tone={failed > 0 ? "bad" : "default"}
      />
    </StatBar>
  );
}

function ProcessChips() {
  const state = usePagingStore((s) => s.state);
  const killProcess = usePagingStore((s) => s.killProcess);
  const [tablePid, setTablePid] = useState<string | null>(null);

  const list = Object.values(state.processes).sort(
    (a, b) => a.createdAt - b.createdAt,
  );
  const tableProc = tablePid ? state.processes[tablePid] : null;

  if (list.length === 0) return null;

  return (
    <>
      <div className="flex gap-1.5 overflow-x-auto px-3 pb-0.5">
        {list.map((p) => (
          <button
            key={p.id}
            className="flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-xs transition-transform duration-150 active:scale-95"
            style={{ borderColor: `${p.color}80`, color: p.color }}
            onClick={() => setTablePid(p.id)}
          >
            <Table2 className="size-3" />
            {p.id}
            <span className="text-muted-foreground">{p.size} KB</span>
          </button>
        ))}
      </div>

      <Drawer
        open={tablePid !== null}
        onOpenChange={(open) => !open && setTablePid(null)}
      >
        <DrawerContent className="max-h-[85dvh]">
          {tableProc && (
            <>
              <DrawerHeader className="pb-2">
                <DrawerTitle className="font-display">
                  Page table: {tableProc.id}
                </DrawerTitle>
                <DrawerDescription>
                  {tableProc.size} KB in{" "}
                  {pagesNeeded(tableProc.size, state.pageSize)} pages of{" "}
                  {state.pageSize} KB. Internal waste in the last page:{" "}
                  {internalFragKB(state, tableProc.id)} KB.
                </DrawerDescription>
              </DrawerHeader>
              <div className="overflow-y-auto px-6 pb-4">
                <table className="w-full font-mono text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                      <th className="py-1.5 font-normal">Page #</th>
                      <th className="py-1.5 font-normal">Frame #</th>
                      <th className="py-1.5 font-normal">Physical range (KB)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.pageTables[tableProc.id].map((frame, page) => (
                      <tr key={page} className="border-b border-border/50">
                        <td className="py-1.5 tabular">{page}</td>
                        <td className="py-1.5 tabular text-primary">{frame}</td>
                        <td className="py-1.5 tabular text-muted-foreground">
                          {frame * state.pageSize}–
                          {(frame + 1) * state.pageSize - 1}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-6 pb-8">
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={() => {
                    killProcess(tableProc.id);
                    setTablePid(null);
                    toast(`${tableProc.id} killed`, {
                      description: "Frames cleared. No coalescing needed: that is the point of paging.",
                    });
                  }}
                >
                  Kill {tableProc.id}
                </Button>
              </div>
            </>
          )}
        </DrawerContent>
      </Drawer>
    </>
  );
}

const QUICK_SIZES = [64, 100, 256];

export function PagingControls() {
  const [size, setSize] = useState(100);
  const allocateProcess = usePagingStore((s) => s.allocateProcess);
  const reset = usePagingStore((s) => s.reset);
  const pageSize = usePagingStore((s) => s.state.pageSize);
  const demoRunning = usePagingStore((s) => s.demoRunning);
  const demoCaption = usePagingStore((s) => s.demoCaption);
  const demoStep = usePagingStore((s) => s.demoStep);
  const demoTotal = usePagingStore((s) => s.demoTotal);
  const setDemo = usePagingStore((s) => s.setDemo);

  const handleAllocate = () => {
    const ok = allocateProcess(size);
    if (!ok) {
      const f = usePagingStore.getState().lastFailure;
      if (f) {
        toast.error(`${f.size} KB request failed`, {
          description: `Needs ${f.needed} frames, only ${f.freeFrames} free. Out of memory is the ONLY failure mode here: external fragmentation cannot happen with paging.`,
        });
      }
    } else {
      const needed = Math.ceil(size / pageSize);
      const waste = needed * pageSize - size;
      toast.success(`Allocated ${size} KB in ${needed} frames`, {
        description:
          waste > 0
            ? `${waste} KB internal fragmentation in the last page.`
            : "Exact page multiple: zero internal waste.",
      });
    }
  };

  return (
    <div className="flex flex-col gap-2.5 px-3 pb-3">
      <PagingStats />
      <DemoCaptionBar caption={demoCaption} step={demoStep} total={demoTotal} />
      <ProcessChips />
      <div className="flex items-center gap-3">
        <Slider
          value={[size]}
          min={4}
          max={512}
          step={4}
          onValueChange={([v]) => setSize(v)}
          className="flex-1 touch-none"
          aria-label="Request size"
        />
        <span className="w-16 shrink-0 text-right font-mono text-sm font-semibold tabular">
          {size}
          <span className="ml-0.5 text-[10px] font-normal text-muted-foreground">
            KB
          </span>
        </span>
      </div>
      <div className="flex gap-1.5">
        {QUICK_SIZES.map((kb) => (
          <Button
            key={kb}
            variant={size === kb ? "secondary" : "outline"}
            size="sm"
            className="h-7 flex-none px-2.5 font-mono text-xs"
            onClick={() => setSize(kb)}
          >
            {kb}
          </Button>
        ))}
        <Button
          className="h-9 flex-1 font-medium transition-transform duration-150 active:scale-[0.97]"
          onClick={handleAllocate}
        >
          <Plus data-slot="icon" />
          Allocate {size} KB
        </Button>
      </div>
      <div className="flex items-center gap-1.5">
        <Select
          value={String(pageSize)}
          onValueChange={(v) => {
            reset(Number(v));
            toast(`Page size set to ${v} KB`, {
              description: `Memory reset: ${1024 / Number(v)} frames. Bigger pages mean smaller page tables but more internal waste.`,
            });
          }}
        >
          <SelectTrigger className="h-9 flex-1 font-mono text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[8, 16, 32].map((kb) => (
              <SelectItem key={kb} value={String(kb)} className="font-mono">
                {kb} KB pages · {1024 / kb} frames
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9"
          aria-label="Reset paging memory"
          onClick={() => {
            reset(pageSize);
            toast("Paging memory reset");
          }}
        >
          <RotateCcw data-slot="icon" />
        </Button>
        <div className="flex h-9 items-center gap-2 rounded-md border border-border px-2.5">
          <Zap
            className={`size-3.5 ${demoRunning ? "text-warning" : "text-muted-foreground"}`}
          />
          <Switch
            checked={demoRunning}
            onCheckedChange={setDemo}
            aria-label="Run paging demo"
          />
        </div>
      </div>
    </div>
  );
}
