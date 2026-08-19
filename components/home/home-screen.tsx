"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronRight } from "lucide-react";
import { colorForIndex } from "@/engine/types";
import { ThemeToggle } from "@/components/theme-toggle";

/*
 * The hero strip plays the app's entire argument on loop:
 * allocate, free, fail by fragmentation, compact. Each scene is a
 * block layout; stable ids let Framer's layout animation slide the
 * surviving blocks into place, exactly like the real grid does.
 */
type SceneBlock = {
  id: string;
  size: number; // KB, drives flex-grow
  kind: "free" | number; // number = process palette index
  flagged?: boolean; // hole too small for the pending request
};

type Scene = {
  caption: string;
  tone: "default" | "bad" | "good";
  blocks: SceneBlock[];
};

const SCENES: Scene[] = [
  {
    caption: "1024 KB of contiguous memory",
    tone: "default",
    blocks: [{ id: "hole-a", size: 1024, kind: "free" }],
  },
  {
    caption: "Allocate P1, P2, P3, P4",
    tone: "default",
    blocks: [
      { id: "p1", size: 192, kind: 0 },
      { id: "p2", size: 256, kind: 1 },
      { id: "p3", size: 160, kind: 2 },
      { id: "p4", size: 224, kind: 3 },
      { id: "hole-a", size: 192, kind: "free" },
    ],
  },
  {
    caption: "Kill P1 and P3: holes open up",
    tone: "default",
    blocks: [
      { id: "hole-b", size: 192, kind: "free" },
      { id: "p2", size: 256, kind: 1 },
      { id: "hole-c", size: 160, kind: "free" },
      { id: "p4", size: 224, kind: 3 },
      { id: "hole-a", size: 192, kind: "free" },
    ],
  },
  {
    caption: "Request 320 KB fails: 544 KB free, largest hole 192",
    tone: "bad",
    blocks: [
      { id: "hole-b", size: 192, kind: "free", flagged: true },
      { id: "p2", size: 256, kind: 1 },
      { id: "hole-c", size: 160, kind: "free", flagged: true },
      { id: "p4", size: 224, kind: 3 },
      { id: "hole-a", size: 192, kind: "free", flagged: true },
    ],
  },
  {
    caption: "Compact: blocks slide down, the request fits",
    tone: "good",
    blocks: [
      { id: "p2", size: 256, kind: 1 },
      { id: "p4", size: 224, kind: 3 },
      { id: "hole-a", size: 544, kind: "free" },
    ],
  },
];

const SCENE_MS = 2000;
// Frozen frame for reduced motion: the fragmented state is the one
// that explains the app best as a still image.
const STATIC_SCENE = 3;

function StoryStrip() {
  const reduceMotion = useReducedMotion();
  const [scene, setScene] = useState(0);

  useEffect(() => {
    if (reduceMotion) return;
    const t = setInterval(() => {
      setScene((s) => (s + 1) % SCENES.length);
    }, SCENE_MS);
    return () => clearInterval(t);
  }, [reduceMotion]);

  const current = SCENES[reduceMotion ? STATIC_SCENE : scene];

  return (
    <div className="w-full">
      <div className="flex h-11 w-full gap-px overflow-hidden rounded-md border border-border/70 bg-card p-px">
        <AnimatePresence initial={false} mode="popLayout">
          {current.blocks.map((b) => (
            <motion.div
              key={b.id}
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.45, ease: [0.23, 1, 0.32, 1] }}
              style={{
                flexGrow: b.size,
                flexBasis: 0,
                backgroundColor:
                  typeof b.kind === "number" ? colorForIndex(b.kind) : undefined,
              }}
              className={
                b.kind === "free"
                  ? b.flagged
                    ? "hatch-warn rounded-[3px] bg-background/60"
                    : "hatch-free rounded-[3px] bg-background/60"
                  : "rounded-[3px] opacity-90"
              }
            />
          ))}
        </AnimatePresence>
      </div>
      <div className="mt-2 flex h-4 items-center justify-between font-mono text-[10px] tracking-wide">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={current.caption}
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -3 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className={
              current.tone === "bad"
                ? "text-destructive"
                : current.tone === "good"
                  ? "text-primary"
                  : "text-muted-foreground"
            }
          >
            {current.caption}
          </motion.span>
        </AnimatePresence>
        <span className="text-muted-foreground/50">0 . . 1024 KB</span>
      </div>
    </div>
  );
}

function ContiguousGlyph() {
  return (
    <div className="flex h-9 w-9 shrink-0 flex-col gap-[3px] rounded-sm border border-border/70 bg-background/60 p-[5px]">
      <div className="h-full rounded-[2px]" style={{ backgroundColor: colorForIndex(0) }} />
      <div className="hatch-free h-full rounded-[2px]" />
      <div className="h-full rounded-[2px]" style={{ backgroundColor: colorForIndex(3) }} />
    </div>
  );
}

function PagingGlyph() {
  const owners: (number | null)[] = [1, 1, null, 4, null, 1, null, 4, null];
  return (
    <div className="grid h-9 w-9 shrink-0 grid-cols-3 gap-[3px] rounded-sm border border-border/70 bg-background/60 p-[5px]">
      {owners.map((o, i) => (
        <div
          key={i}
          className={o === null ? "hatch-free rounded-[2px]" : "rounded-[2px]"}
          style={o === null ? undefined : { backgroundColor: colorForIndex(o) }}
        />
      ))}
    </div>
  );
}

function ModeCard({
  glyph,
  title,
  desc,
  onClick,
}: {
  glyph: React.ReactNode;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group flex w-full items-center gap-3 rounded-lg border border-border/70 bg-card px-3.5 py-3 text-left transition-[transform,border-color] duration-150 ease-out active:scale-[0.98] hover:border-primary/40"
    >
      {glyph}
      <div className="min-w-0 flex-1">
        <div className="font-display text-sm font-semibold tracking-tight">
          {title}
        </div>
        <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
          {desc}
        </div>
      </div>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground/60 transition-transform duration-150 ease-out group-hover:translate-x-0.5 group-hover:text-primary" />
    </button>
  );
}

export function HomeScreen({
  onEnter,
}: {
  onEnter: (mode: "contiguous" | "paging") => void;
}) {
  return (
    <div className="flex h-full flex-col px-5 pb-[max(env(safe-area-inset-bottom),1.25rem)]">
      <div className="flex justify-end pt-3">
        <ThemeToggle />
      </div>
      {/* Hero */}
      <div className="flex flex-1 flex-col justify-center gap-6">
        <div>
          <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-border/70 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
            <span className="inline-block size-1.5 rounded-full bg-primary" />
            OS memory simulator
          </div>
          <h1 className="font-display text-4xl font-semibold leading-[1.05] tracking-tight">
            Mem<span className="text-primary">Playground</span>
            <span className="animate-cursor ml-1 inline-block h-[0.8em] w-[0.42em] translate-y-[0.06em] bg-primary/80" />
          </h1>
          <p className="mt-3 max-w-[34ch] text-[13px] leading-relaxed text-muted-foreground">
            Allocate processes into 1024 KB of RAM, watch fragmentation build
            up, then fix it. Every concept from the memory management unit,
            live and touchable.
          </p>
        </div>

        <StoryStrip />
      </div>

      {/* Entry points */}
      <div className="flex flex-col gap-2.5">
        <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground/70">
          Choose a mode
        </div>
        <ModeCard
          glyph={<ContiguousGlyph />}
          title="Contiguous allocation"
          desc="First, Best and Worst Fit. External fragmentation, then compaction."
          onClick={() => onEnter("contiguous")}
        />
        <ModeCard
          glyph={<PagingGlyph />}
          title="Paging"
          desc="Fixed frames and page tables. Internal waste, address translation."
          onClick={() => onEnter("paging")}
        />
        <div className="mt-3 text-center font-mono text-[9px] tracking-wide text-muted-foreground/50">
          CSE 323 · Operating Systems Design · North South University
        </div>
      </div>
    </div>
  );
}
