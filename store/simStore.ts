"use client";

import { useMemo } from "react";
import { create } from "zustand";
import {
  allocate,
  assertInvariants,
  compact,
  createInitialBlocks,
  free,
} from "@/engine/allocator";
import { toast } from "sonner";
import { contigDemoScript, type DemoStep } from "@/engine/demo";
import { computeMetrics } from "@/engine/metrics";
import {
  colorForIndex,
  type LogEntry,
  type LogKind,
  type MemoryBlock,
  type Process,
  type StatsSnapshot,
  type Strategy,
} from "@/engine/types";

const TOTAL_MEMORY = 1024;
const LOG_CAP = 200;
const STATS_CAP = 400;

export type FailureFlash = {
  reason: "fragmentation" | "out-of-memory";
  size: number;
  totalFree: number;
  largestHole: number;
  nonce: number;
};

export type CompactFlash = { movedKB: number; movedCount: number; nonce: number };

interface SimStore {
  totalMemory: number;
  blocks: MemoryBlock[];
  processes: Record<string, Process>;
  strategy: Strategy;
  log: LogEntry[];
  stats: StatsSnapshot[];
  failedRequests: number;
  requestSize: number;
  lastFailure: FailureFlash | null;
  lastCompact: CompactFlash | null;
  demoRunning: boolean;
  demoCaption: string | null;
  demoStep: number;
  demoTotal: number;

  allocateProcess: (size: number) => boolean;
  killProcess: (pid: string) => void;
  compactMemory: () => CompactFlash | null;
  reset: () => void;
  setStrategy: (s: Strategy) => void;
  setRequestSize: (kb: number) => void;
  setDemo: (on: boolean) => void;
}

let logId = 0;
let opCounter = 0;
let processCounter = 0;
let flashNonce = 0;

/*
 * Demo playback bookkeeping. The timer is a setTimeout chain (steps have
 * individual dwell times); the token invalidates any in-flight timeout
 * when the demo is stopped or restarted with a different strategy.
 */
let demoTimer: ReturnType<typeof setTimeout> | null = null;
let demoToken = 0;
let demoPids: string[] = [];

function stopDemoTimer() {
  demoToken += 1;
  if (demoTimer) {
    clearTimeout(demoTimer);
    demoTimer = null;
  }
}

function entry(kind: LogKind, message: string): LogEntry {
  logId += 1;
  return { id: logId, time: Date.now(), kind, message };
}

function snapshot(blocks: MemoryBlock[], total: number): StatsSnapshot {
  opCounter += 1;
  const m = computeMetrics(blocks, total);
  return {
    op: opCounter,
    time: Date.now(),
    totalFree: m.totalFree,
    totalOccupied: m.totalOccupied,
    utilization: m.utilization,
    largestHole: m.largestHole,
    holeCount: m.holeCount,
    fragmentation: m.fragmentation,
  };
}

function push<T>(list: T[], item: T, cap: number): T[] {
  const next = [...list, item];
  return next.length > cap ? next.slice(next.length - cap) : next;
}

function checkInvariants(blocks: MemoryBlock[], total: number) {
  if (process.env.NODE_ENV !== "production") {
    assertInvariants(blocks, total);
  }
}

export const useSimStore = create<SimStore>((set, get) => ({
  totalMemory: TOTAL_MEMORY,
  blocks: createInitialBlocks(TOTAL_MEMORY),
  processes: {},
  strategy: "first-fit",
  log: [entry("info", `Memory initialized: ${TOTAL_MEMORY} KB contiguous space`)],
  stats: [],
  failedRequests: 0,
  requestSize: 128,
  lastFailure: null,
  lastCompact: null,
  demoRunning: false,
  demoCaption: null,
  demoStep: 0,
  demoTotal: 0,

  allocateProcess: (size) => {
    const s = get();
    processCounter += 1;
    const pid = `P${processCounter}`;
    const res = allocate(s.blocks, size, pid, s.strategy);

    if (!res.ok) {
      processCounter -= 1; // the process never existed
      flashNonce += 1;
      const isFrag = res.reason === "fragmentation";
      set({
        failedRequests: s.failedRequests + 1,
        lastFailure: {
          reason: res.reason,
          size,
          totalFree: res.totalFree,
          largestHole: res.largestHole,
          nonce: flashNonce,
        },
        log: push(
          s.log,
          entry(
            isFrag ? "alloc-fail-frag" : "alloc-fail-oom",
            isFrag
              ? `FAILED ${size} KB: ${res.totalFree} KB free but largest hole is ${res.largestHole} KB (external fragmentation)`
              : `FAILED ${size} KB: only ${res.totalFree} KB free (out of memory)`,
          ),
          LOG_CAP,
        ),
        stats: push(s.stats, snapshot(s.blocks, s.totalMemory), STATS_CAP),
      });
      return false;
    }

    checkInvariants(res.blocks, s.totalMemory);
    const proc: Process = {
      id: pid,
      size,
      color: colorForIndex(processCounter - 1),
      createdAt: Date.now(),
    };
    set({
      blocks: res.blocks,
      processes: { ...s.processes, [pid]: proc },
      lastFailure: null,
      log: push(
        s.log,
        entry(
          "alloc",
          `${pid} allocated ${size} KB at ${res.placed.start} (${s.strategy})`,
        ),
        LOG_CAP,
      ),
      stats: push(s.stats, snapshot(res.blocks, s.totalMemory), STATS_CAP),
    });
    return true;
  },

  killProcess: (pid) => {
    const s = get();
    const res = free(s.blocks, pid);
    if (!res) return;
    checkInvariants(res.blocks, s.totalMemory);
    const processes = { ...s.processes };
    delete processes[pid];
    set({
      blocks: res.blocks,
      processes,
      log: push(
        s.log,
        entry("free", `${pid} killed, ${res.freedKB} KB freed and coalesced`),
        LOG_CAP,
      ),
      stats: push(s.stats, snapshot(res.blocks, s.totalMemory), STATS_CAP),
    });
  },

  compactMemory: () => {
    const s = get();
    const res = compact(s.blocks);
    checkInvariants(res.blocks, s.totalMemory);
    flashNonce += 1;
    const flash: CompactFlash = {
      movedKB: res.movedKB,
      movedCount: res.movedCount,
      nonce: flashNonce,
    };
    set({
      blocks: res.blocks,
      lastFailure: null,
      lastCompact: flash,
      log: push(
        s.log,
        entry(
          "compact",
          `Compaction: ${res.movedCount} blocks relocated, ${res.movedKB} KB moved`,
        ),
        LOG_CAP,
      ),
      stats: push(s.stats, snapshot(res.blocks, s.totalMemory), STATS_CAP),
    });
    return flash;
  },

  reset: () => {
    stopDemoTimer();
    demoPids = [];
    processCounter = 0;
    opCounter = 0;
    set({
      blocks: createInitialBlocks(TOTAL_MEMORY),
      processes: {},
      log: [entry("reset", `Memory reset: ${TOTAL_MEMORY} KB free`)],
      stats: [],
      failedRequests: 0,
      lastFailure: null,
      lastCompact: null,
      demoRunning: false,
      demoCaption: null,
      demoStep: 0,
      demoTotal: 0,
    });
  },

  setStrategy: (strategy) => {
    const s = get();
    if (s.strategy === strategy) return;
    set({
      strategy,
      log: push(
        s.log,
        entry("strategy", `Strategy switched to ${strategy} (future allocations)`),
        LOG_CAP,
      ),
    });
    // Switching strategy mid-demo restarts the demo for the new strategy.
    if (s.demoRunning) get().setDemo(true);
  },

  setRequestSize: (kb) => set({ requestSize: kb }),

  setDemo: (on) => {
    stopDemoTimer();
    if (!on) {
      set({ demoRunning: false, demoCaption: null, demoStep: 0, demoTotal: 0 });
      return;
    }

    get().reset(); // fresh 1024 KB stage (also clears demo fields)
    const token = demoToken;
    const script = contigDemoScript(get().strategy);
    set({ demoRunning: true, demoTotal: script.length });

    const execute = (step: DemoStep) => {
      if (step.kind === "alloc") {
        const ok = get().allocateProcess(step.size);
        if (ok) {
          demoPids.push(`P${processCounter}`);
        } else {
          const f = get().lastFailure;
          if (f?.reason === "fragmentation") {
            toast.error(`${f.size} KB request failed`, {
              description: `${f.totalFree} KB free, but the largest hole is ${f.largestHole} KB. External fragmentation. Compact to recover.`,
            });
          }
        }
      } else if (step.kind === "kill") {
        const pid = demoPids[step.index];
        if (pid) get().killProcess(pid);
      } else if (step.kind === "compact") {
        const flash = get().compactMemory();
        if (flash && flash.movedCount > 0) {
          toast.success(`Compaction done: moved ${flash.movedKB} KB`, {
            description: `${flash.movedCount} blocks relocated. That relocation is the cost of compaction.`,
          });
        }
      }
    };

    const runFrom = (index: number) => {
      if (token !== demoToken) return;
      const step = script[index];
      execute(step);
      set({ demoCaption: step.caption, demoStep: index + 1 });
      if (index + 1 < script.length) {
        demoTimer = setTimeout(() => runFrom(index + 1), step.dwell);
      } else {
        // Linger on the final caption, then quietly end the demo.
        demoTimer = setTimeout(() => {
          if (token !== demoToken) return;
          set({
            demoRunning: false,
            demoCaption: null,
            demoStep: 0,
            demoTotal: 0,
          });
        }, step.dwell + 1500);
      }
    };

    // Small beat after the reset so the empty grid registers first.
    demoTimer = setTimeout(() => runFrom(0), 600);
  },
}));

/** Live metrics, memoized so the selector snapshot stays referentially stable. */
export function useMetrics() {
  const blocks = useSimStore((s) => s.blocks);
  const totalMemory = useSimStore((s) => s.totalMemory);
  return useMemo(() => computeMetrics(blocks, totalMemory), [blocks, totalMemory]);
}
