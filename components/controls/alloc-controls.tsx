"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ArchiveRestore, Plus, RotateCcw, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSimStore } from "@/store/simStore";
import { DemoCaptionBar } from "@/components/dashboard/demo-caption";

const QUICK_SIZES = [64, 128, 256];

export function AllocControls() {
  const requestSize = useSimStore((s) => s.requestSize);
  const setRequestSize = useSimStore((s) => s.setRequestSize);
  const allocateProcess = useSimStore((s) => s.allocateProcess);
  const compactMemory = useSimStore((s) => s.compactMemory);
  const reset = useSimStore((s) => s.reset);
  const demoRunning = useSimStore((s) => s.demoRunning);
  const demoCaption = useSimStore((s) => s.demoCaption);
  const demoStep = useSimStore((s) => s.demoStep);
  const demoTotal = useSimStore((s) => s.demoTotal);
  const setDemo = useSimStore((s) => s.setDemo);
  const lastFailure = useSimStore((s) => s.lastFailure);

  const [resetOpen, setResetOpen] = useState(false);

  const fragPending = lastFailure?.reason === "fragmentation";

  const handleAllocate = () => {
    const ok = allocateProcess(requestSize);
    if (!ok) {
      const f = useSimStore.getState().lastFailure;
      if (!f) return;
      if (f.reason === "fragmentation") {
        toast.error(`${f.size} KB request failed`, {
          description: `${f.totalFree} KB free, but the largest hole is ${f.largestHole} KB. External fragmentation. Compact to recover.`,
        });
      } else {
        toast.error(`${f.size} KB request failed`, {
          description: `Only ${f.totalFree} KB free in total. Genuinely out of memory: kill a process first.`,
        });
      }
    }
  };

  const handleCompact = () => {
    const flash = compactMemory();
    if (flash) {
      toast.success(
        flash.movedCount === 0
          ? "Already compact"
          : `Compaction done: moved ${flash.movedKB} KB`,
        {
          description:
            flash.movedCount === 0
              ? "No occupied block needed to move."
              : `${flash.movedCount} blocks relocated. That relocation is the cost of compaction.`,
        },
      );
    }
  };

  return (
    <div className="flex flex-col gap-2.5 px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
      <DemoCaptionBar caption={demoCaption} step={demoStep} total={demoTotal} />
      <div className="flex items-center gap-3">
        <span className="shrink-0 text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
          Request
        </span>
        <Slider
          value={[requestSize]}
          min={8}
          max={512}
          step={8}
          onValueChange={([v]) => setRequestSize(v)}
          className="flex-1 touch-none"
          aria-label="Request size"
        />
        <span className="w-16 shrink-0 text-right font-mono text-sm font-semibold tabular text-foreground">
          {requestSize}
          <span className="ml-0.5 text-[10px] font-normal text-muted-foreground">
            KB
          </span>
        </span>
      </div>

      <div className="flex gap-1.5">
        {QUICK_SIZES.map((kb) => (
          <Button
            key={kb}
            variant={requestSize === kb ? "secondary" : "outline"}
            size="sm"
            className="h-7 flex-none px-2.5 font-mono text-xs"
            onClick={() => setRequestSize(kb)}
          >
            {kb}
          </Button>
        ))}
        <Button
          className="h-9 flex-1 font-medium shadow-[0_0_18px_-6px_var(--primary)] transition-transform duration-150 active:scale-[0.97]"
          onClick={handleAllocate}
        >
          <Plus data-slot="icon" />
          Allocate {requestSize} KB
        </Button>
      </div>

      <div className="flex items-center gap-1.5">
        <Button
          variant="secondary"
          className={`h-9 flex-1 transition-transform duration-150 active:scale-[0.97] ${
            fragPending
              ? "animate-compact-pulse border border-warning/60 text-warning"
              : ""
          }`}
          onClick={handleCompact}
        >
          <ArchiveRestore data-slot="icon" />
          Compact
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9"
          aria-label="Reset memory"
          onClick={() => setResetOpen(true)}
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
            aria-label="Run strategy demo"
          />
        </div>
      </div>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="font-display">Reset memory?</DialogTitle>
            <DialogDescription>
              Kills every process and returns to a single 1024 KB free block.
              The event log and chart history are cleared.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row justify-end gap-2">
            <Button variant="secondary" onClick={() => setResetOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                reset();
                setResetOpen(false);
                toast("Memory reset", { description: "1024 KB free" });
              }}
            >
              Reset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
