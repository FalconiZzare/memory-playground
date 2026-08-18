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
import { nextAutoEvent } from "@/engine/autorun";
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
  autoRun: boolean;
  autoRunMs: number;

  allocateProcess: (size: number) => boolean;
  killProcess: (pid: string) => void;
  compactMemory: () => CompactFlash | null;
  reset: () => void;
  setStrategy: (s: Strategy) => void;
  setRequestSize: (kb: number) => void;
  setAutoRun: (on: boolean) => void;
  setAutoRunMs: (ms: number) => void;
  autoTick: () => void;
}

let logId = 0;
let opCounter = 0;
let processCounter = 0;
let flashNonce = 0;
let autoTimer: ReturnType<typeof setInterval> | null = null;

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
  autoRun: false,
  autoRunMs: 900,

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
    if (autoTimer) {
      clearInterval(autoTimer);
      autoTimer = null;
    }
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
      autoRun: false,
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
  },

  setRequestSize: (kb) => set({ requestSize: kb }),

  setAutoRun: (on) => {
    if (autoTimer) {
      clearInterval(autoTimer);
      autoTimer = null;
    }
    if (on) {
      autoTimer = setInterval(() => get().autoTick(), get().autoRunMs);
    }
    set({ autoRun: on });
  },

  setAutoRunMs: (ms) => {
    set({ autoRunMs: ms });
    if (get().autoRun) {
      if (autoTimer) clearInterval(autoTimer);
      autoTimer = setInterval(() => get().autoTick(), ms);
    }
  },

  autoTick: () => {
    const s = get();
    const ev = nextAutoEvent(Math.random, Object.keys(s.processes));
    if (ev.type === "alloc") {
      s.allocateProcess(ev.size);
    } else {
      s.killProcess(ev.processId);
    }
  },
}));

/** Live metrics, memoized so the selector snapshot stays referentially stable. */
export function useMetrics() {
  const blocks = useSimStore((s) => s.blocks);
  const totalMemory = useSimStore((s) => s.totalMemory);
  return useMemo(() => computeMetrics(blocks, totalMemory), [blocks, totalMemory]);
}
