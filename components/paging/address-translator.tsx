"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Crosshair } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePagingStore } from "@/store/pagingStore";

const STEP_EASE = [0.23, 1, 0.32, 1] as const;

function Step({
  index,
  label,
  value,
}: {
  index: number;
  label: string;
  value: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.35, duration: 0.3, ease: STEP_EASE }}
      className="flex items-baseline gap-2 font-mono text-xs"
    >
      <span className="w-3.5 shrink-0 text-muted-foreground/60">{index + 1}</span>
      <span className="text-muted-foreground">{label}</span>
      <span className="ml-auto font-semibold text-primary tabular">{value}</span>
    </motion.div>
  );
}

export function AddressTranslator() {
  const state = usePagingStore((s) => s.state);
  const pid = usePagingStore((s) => s.translationPid);
  const setPid = usePagingStore((s) => s.setTranslationPid);
  const addr = usePagingStore((s) => s.logicalAddr);
  const setAddr = usePagingStore((s) => s.setLogicalAddr);
  const runTranslation = usePagingStore((s) => s.runTranslation);
  const result = usePagingStore((s) => s.translation);

  const list = Object.values(state.processes).sort(
    (a, b) => a.createdAt - b.createdAt,
  );
  const proc = pid ? state.processes[pid] : null;
  const maxAddr = proc ? proc.size - 1 : 0;

  return (
    <Card className="mx-3 shrink-0 gap-3 border-border bg-card/60 py-4">
      <CardHeader className="px-4">
        <CardTitle className="flex items-center gap-2 font-display text-sm">
          <Crosshair className="size-4 text-primary" />
          Address translation
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 px-4">
        {list.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Allocate a process first, then translate one of its logical
            addresses to a physical one.
          </p>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <Select value={pid ?? undefined} onValueChange={setPid}>
                <SelectTrigger className="h-9 w-28 font-mono text-xs">
                  <SelectValue placeholder="Process" />
                </SelectTrigger>
                <SelectContent>
                  {list.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="font-mono">
                      {p.id} · {p.size} KB
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex flex-1 items-center gap-2">
                <Slider
                  value={[Math.min(addr, maxAddr)]}
                  min={0}
                  max={Math.max(maxAddr, 1)}
                  step={1}
                  disabled={!proc}
                  onValueChange={([v]) => setAddr(v)}
                  className="flex-1 touch-none"
                  aria-label="Logical address"
                />
                <span className="w-12 shrink-0 text-right font-mono text-sm font-semibold tabular">
                  {addr}
                </span>
              </div>
            </div>
            <Button
              disabled={!proc}
              className="h-9 transition-transform duration-150 active:scale-[0.97]"
              onClick={runTranslation}
            >
              Translate logical address {addr}
              <ArrowRight data-slot="icon" />
            </Button>

            <AnimatePresence mode="wait">
              {result && result.ok && proc && (
                <motion.div
                  key={`${pid}-${addr}-ok`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col gap-1.5 rounded-md border border-border bg-background/50 p-3"
                >
                  <Step
                    index={0}
                    label={`page = ⌊${addr} ÷ ${state.pageSize}⌋`}
                    value={`page ${result.pageNo}`}
                  />
                  <Step
                    index={1}
                    label={`offset = ${addr} mod ${state.pageSize}`}
                    value={`${result.offset} KB`}
                  />
                  <Step
                    index={2}
                    label={`page table[${result.pageNo}] lookup`}
                    value={`frame ${result.frameNo}`}
                  />
                  <Step
                    index={3}
                    label={`physical = ${result.frameNo} × ${state.pageSize} + ${result.offset}`}
                    value={`${result.physical} KB`}
                  />
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1.5 }}
                    className="pt-1 text-[11px] text-muted-foreground"
                  >
                    Frame {result.frameNo} is pulsing in the grid above.
                  </motion.p>
                </motion.div>
              )}
              {result && !result.ok && (
                <motion.div
                  key={`${pid}-${addr}-fault`}
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="rounded-md border border-destructive/60 bg-destructive/10 p-3 font-mono text-xs text-destructive"
                >
                  SEGMENTATION FAULT
                  <span className="block pt-1 text-[11px] text-destructive/80">
                    Address {addr} is outside this process ({result.limit} KB).
                    Valid logical range: 0–{result.limit - 1}.
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </CardContent>
    </Card>
  );
}
