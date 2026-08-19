import type { Strategy } from "./types";

/*
 * Scripted demo scenarios. Pure data: the stores play these back on a
 * timer. Each step is one engine operation plus the caption narrating it.
 *
 * The contiguous script builds the SAME hole pattern for every strategy
 * (holes of 192, 96, 256 KB in address order), then requests 96 KB.
 * That request is the strategy-revealing moment: First Fit takes the
 * 192 hole, Best Fit the exact 96, Worst Fit the 256. The finale
 * (320 KB fails by fragmentation, compact, retry succeeds) works in
 * all three variants.
 */

export type DemoStep =
  | { kind: "alloc"; size: number; caption: string; dwell: number }
  | { kind: "kill"; index: number; caption: string; dwell: number }
  | { kind: "compact"; caption: string; dwell: number }
  | {
      kind: "translate";
      index: number;
      addr: number;
      caption: string;
      dwell: number;
    };

const SETUP = 1600;
const NARRATE = 2800;
const MOMENT = 3600;

const STRATEGY_MOMENT: Record<Strategy, string> = {
  "first-fit":
    "Request 96 KB. First Fit scans from address 0 and takes the FIRST hole that fits: the 192 KB one, leaving a 96 KB remainder.",
  "best-fit":
    "Request 96 KB. Best Fit picks the TIGHTEST hole: the exact 96 KB one. Zero waste here, but near-misses leave tiny slivers.",
  "worst-fit":
    "Request 96 KB. Worst Fit picks the LARGEST hole: the 256 KB one, so the leftover stays big enough to be useful.",
};

export function contigDemoScript(strategy: Strategy): DemoStep[] {
  return [
    { kind: "alloc", size: 192, caption: "Allocate P1: 192 KB at address 0.", dwell: SETUP },
    { kind: "alloc", size: 64, caption: "Allocate P2: 64 KB.", dwell: SETUP },
    { kind: "alloc", size: 96, caption: "Allocate P3: 96 KB.", dwell: SETUP },
    { kind: "alloc", size: 64, caption: "Allocate P4: 64 KB.", dwell: SETUP },
    { kind: "alloc", size: 256, caption: "Allocate P5: 256 KB.", dwell: SETUP },
    { kind: "alloc", size: 64, caption: "Allocate P6: 64 KB.", dwell: SETUP },
    {
      kind: "alloc",
      size: 288,
      caption: "Allocate P7: 288 KB. Memory is now 100% full.",
      dwell: NARRATE,
    },
    {
      kind: "kill",
      index: 0,
      caption: "Kill P1. A 192 KB hole opens at address 0.",
      dwell: NARRATE,
    },
    {
      kind: "kill",
      index: 2,
      caption: "Kill P3. A 96 KB hole opens mid-memory.",
      dwell: NARRATE,
    },
    {
      kind: "kill",
      index: 4,
      caption:
        "Kill P5. Three scattered holes now: 192, 96 and 256 KB. 544 KB free in total.",
      dwell: MOMENT,
    },
    {
      kind: "alloc",
      size: 96,
      caption: STRATEGY_MOMENT[strategy],
      dwell: MOMENT,
    },
    {
      kind: "alloc",
      size: 320,
      caption:
        "Request 320 KB: FAILS. Enough memory is free in total, but no single hole is big enough. That is external fragmentation.",
      dwell: MOMENT,
    },
    {
      kind: "compact",
      caption:
        "Compact. Occupied blocks slide to low addresses and the holes merge into one.",
      dwell: NARRATE,
    },
    {
      kind: "alloc",
      size: 320,
      caption: "The same 320 KB request now succeeds. Demo complete.",
      dwell: NARRATE,
    },
  ];
}

/*
 * Paging demo. Assumes 16 KB pages (the store resets to that page size
 * before playback). Shows internal fragmentation, trivial deallocation,
 * scattered placement, and finishes on an address translation.
 */
export function pagingDemoScript(): DemoStep[] {
  return [
    {
      kind: "alloc",
      size: 100,
      caption:
        "Allocate P1: 100 KB needs ceil(100/16) = 7 frames. The last frame wastes 12 KB: internal fragmentation.",
      dwell: MOMENT,
    },
    {
      kind: "alloc",
      size: 200,
      caption: "Allocate P2: 200 KB in 13 frames, 8 KB wasted in its last frame.",
      dwell: NARRATE,
    },
    {
      kind: "alloc",
      size: 64,
      caption:
        "Allocate P3: 64 KB is an exact multiple of 16, so 4 frames with zero waste.",
      dwell: NARRATE,
    },
    { kind: "alloc", size: 128, caption: "Allocate P4: 128 KB in 8 frames.", dwell: SETUP },
    {
      kind: "kill",
      index: 0,
      caption:
        "Kill P1. Its 7 frames free instantly: no coalescing needed, unlike contiguous mode.",
      dwell: NARRATE,
    },
    {
      kind: "kill",
      index: 3,
      caption: "Kill P4. Free frames now sit in two separate gaps.",
      dwell: NARRATE,
    },
    {
      kind: "alloc",
      size: 180,
      caption:
        "Allocate P5: 180 KB in 12 frames, SCATTERED across both gaps. Contiguity does not matter, so external fragmentation cannot happen.",
      dwell: MOMENT,
    },
    {
      kind: "translate",
      index: 4,
      addr: 130,
      caption:
        "Translate logical address 130 in P5: page 8, offset 2. The page table maps page 8 to its frame, physical = frame x 16 + 2. Demo complete.",
      dwell: MOMENT,
    },
  ];
}
