"use client";

import { motion } from "motion/react";
import { internalFragKB, pagesNeeded } from "@/engine/paging";
import { usePagingStore } from "@/store/pagingStore";

export function FrameGrid() {
  const state = usePagingStore((s) => s.state);
  const lastPlaced = usePagingStore((s) => s.lastPlaced);
  const translation = usePagingStore((s) => s.translation);
  const translationPid = usePagingStore((s) => s.translationPid);

  const highlightFrame =
    translation && translation.ok ? translation.frameNo : null;

  const cols = state.frames.length <= 64 ? 8 : 16;

  return (
    <div
      className="grid gap-1 px-3"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {state.frames.map((owner, i) => {
        const proc = owner ? state.processes[owner] : null;
        // Waste sliver: only the process's final frame carries internal frag.
        const isLastPage =
          proc &&
          state.pageTables[proc.id][
            pagesNeeded(proc.size, state.pageSize) - 1
          ] === i;
        const wasteKB = isLastPage && proc ? internalFragKB(state, proc.id) : 0;
        const wasteFrac = wasteKB / state.pageSize;
        const placedIdx = lastPlaced.indexOf(i);
        const isTarget = highlightFrame === i;
        const dimmed =
          translationPid !== null &&
          translation !== null &&
          translation.ok &&
          owner !== translationPid;

        return (
          <motion.div
            key={`${i}-${owner ?? "free"}`}
            initial={
              placedIdx >= 0 ? { opacity: 0, scale: 0.85 } : false
            }
            animate={{
              opacity: dimmed ? 0.35 : 1,
              scale: isTarget ? [1, 1.18, 1] : 1,
            }}
            transition={{
              delay: placedIdx >= 0 ? placedIdx * 0.045 : 0,
              duration: isTarget ? 0.6 : 0.25,
              ease: [0.23, 1, 0.32, 1],
            }}
            className={`relative aspect-square overflow-hidden rounded-[5px] border ${
              proc
                ? "border-transparent"
                : "hatch-free border-border bg-card/50"
            } ${isTarget ? "ring-2 ring-primary" : ""}`}
            style={
              proc
                ? {
                    backgroundColor: `${proc.color}42`,
                    borderColor: `${proc.color}80`,
                  }
                : undefined
            }
          >
            <span
              className={`absolute left-1 top-0.5 font-mono text-[8px] ${
                proc ? "text-foreground/70" : "text-muted-foreground/50"
              }`}
            >
              {i}
            </span>
            {wasteFrac > 0 && (
              <div
                className="hatch-waste absolute inset-x-0 bottom-0"
                style={{ height: `${wasteFrac * 100}%` }}
                title={`${wasteKB} KB internal waste`}
              />
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
