"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useSimStore } from "@/store/simStore";

const MAJOR_TICK = 128;
const MINOR_TICK = 32;

function AddressRuler({ total }: { total: number }) {
  const majors: number[] = [];
  const minors: number[] = [];
  for (let kb = 0; kb <= total; kb += MINOR_TICK) {
    (kb % MAJOR_TICK === 0 ? majors : minors).push(kb);
  }
  return (
    <div
      className="relative w-11 shrink-0 select-none font-mono text-[10px] text-muted-foreground/80"
      aria-hidden
    >
      {minors.map((kb) => (
        <span
          key={kb}
          className="absolute right-0 h-px w-1 translate-y-[-50%] bg-muted-foreground/25"
          style={{ top: `${(kb / total) * 100}%` }}
        />
      ))}
      {majors.map((kb) => (
        <div
          key={kb}
          className="absolute right-0 flex translate-y-[-50%] items-center gap-1"
          style={{ top: `${(kb / total) * 100}%` }}
        >
          <span className="tabular">{kb}</span>
          <span className="h-px w-2 bg-muted-foreground/50" />
        </div>
      ))}
    </div>
  );
}

export function RamGrid() {
  const blocks = useSimStore((s) => s.blocks);
  const processes = useSimStore((s) => s.processes);
  const total = useSimStore((s) => s.totalMemory);
  const requestSize = useSimStore((s) => s.requestSize);
  const lastFailure = useSimStore((s) => s.lastFailure);
  const killProcess = useSimStore((s) => s.killProcess);

  const [confirmPid, setConfirmPid] = useState<string | null>(null);
  const [shaking, setShaking] = useState(false);

  // Re-arm the shake during render when a new failure arrives.
  const [handledNonce, setHandledNonce] = useState(0);
  const failureNonce = lastFailure?.nonce ?? 0;
  if (failureNonce !== handledNonce) {
    setHandledNonce(failureNonce);
    if (lastFailure) setShaking(true);
  }

  const confirmProc = confirmPid ? processes[confirmPid] : null;
  const singleHole = blocks.length === 1;

  return (
    <div className="flex min-h-0 flex-1 gap-1 px-3">
      <AddressRuler total={total} />
      <div
        className={`relative min-h-0 flex-1 ${shaking ? "animate-shake" : ""}`}
        onAnimationEnd={() => setShaking(false)}
      >
        <div className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card/60 shadow-[inset_0_1px_0_oklch(1_0_0/4%)]">
          <AnimatePresence initial={false} mode="popLayout">
            {blocks.map((b) => {
              const frac = b.size / total;
              const showLabel = frac > 0.035;
              const showAddr = frac > 0.055;
              const proc = b.processId ? processes[b.processId] : null;
              const tooSmall = b.status === "free" && b.size < requestSize;

              return (
                <motion.div
                  key={b.id}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{
                    layout: { type: "spring", duration: 0.55, bounce: 0.12 },
                    opacity: { duration: 0.18, ease: "easeOut" },
                  }}
                  style={{ flexGrow: b.size, flexBasis: 0, minHeight: 3 }}
                  className={
                    b.status === "occupied"
                      ? "relative flex cursor-pointer items-center overflow-hidden border-b border-background/70 px-2 transition-[filter] duration-150 active:brightness-125"
                      : `relative flex items-center overflow-hidden border-b border-background/70 px-2 ${
                          tooSmall ? "hatch-warn" : "hatch-free"
                        }`
                  }
                  onClick={
                    b.status === "occupied" && b.processId
                      ? () => setConfirmPid(b.processId!)
                      : undefined
                  }
                >
                  {proc && (
                    <>
                      <div
                        className="absolute inset-0"
                        style={{
                          backgroundImage: `linear-gradient(180deg, ${proc.color}55 0%, ${proc.color}2e 100%)`,
                          boxShadow: `inset 0 1px 0 ${proc.color}40`,
                        }}
                      />
                      <div
                        className="absolute inset-y-0 left-0 w-[3px]"
                        style={{ backgroundColor: proc.color }}
                      />
                      {showLabel && (
                        <span
                          className="relative font-mono text-xs font-medium"
                          style={{ color: proc.color }}
                        >
                          {proc.id}
                          <span className="text-foreground/65">
                            {" "}
                            · {b.size} KB
                          </span>
                        </span>
                      )}
                      {showAddr && (
                        <span className="relative ml-auto font-mono text-[9px] text-foreground/40 tabular">
                          @{b.start}
                        </span>
                      )}
                    </>
                  )}
                  {b.status === "free" && showLabel && (
                    <span
                      className={`relative font-mono text-xs ${
                        tooSmall ? "text-warning" : "text-muted-foreground"
                      }`}
                    >
                      {b.size} KB free
                      {singleHole && (
                        <span className="text-muted-foreground/50">
                          {" "}
                          · one contiguous hole
                        </span>
                      )}
                      {tooSmall && (
                        <span className="ml-1.5 rounded-sm border border-warning/50 px-1 py-px text-[9px] uppercase tracking-wide">
                          too small
                        </span>
                      )}
                    </span>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      <Dialog
        open={confirmPid !== null}
        onOpenChange={(open) => !open && setConfirmPid(null)}
      >
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="font-display">
              Kill {confirmProc?.id}?
            </DialogTitle>
            <DialogDescription>
              Frees {confirmProc?.size} KB. Adjacent holes will merge into one.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirmPid(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (confirmPid) {
                  const size = processes[confirmPid]?.size;
                  killProcess(confirmPid);
                  toast(`${confirmPid} killed`, {
                    description: `${size} KB freed and coalesced`,
                  });
                }
                setConfirmPid(null);
              }}
            >
              Kill process
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
