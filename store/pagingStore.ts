"use client";

import { create } from "zustand";
import {
  createPagingState,
  pagingAllocate,
  pagingFree,
  translate,
  type PagingState,
  type TranslationResult,
} from "@/engine/paging";
import { colorForIndex } from "@/engine/types";
import { pagingDemoScript, type DemoStep } from "@/engine/demo";

const TOTAL_MEMORY = 1024;
const DEFAULT_PAGE_SIZE = 16;

export type PagingFailure = {
  size: number;
  freeFrames: number;
  needed: number;
  nonce: number;
};

interface PagingStore {
  state: PagingState;
  /** Frames placed by the most recent allocation, for the entry stagger. */
  lastPlaced: number[];
  lastFailure: PagingFailure | null;
  failedRequests: number;
  /** Translation widget state. */
  translationPid: string | null;
  logicalAddr: number;
  translation: TranslationResult | null;
  demoRunning: boolean;
  demoCaption: string | null;
  demoStep: number;
  demoTotal: number;

  allocateProcess: (size: number) => boolean;
  killProcess: (pid: string) => void;
  reset: (pageSize?: number) => void;
  setDemo: (on: boolean) => void;
  setTranslationPid: (pid: string | null) => void;
  setLogicalAddr: (addr: number) => void;
  runTranslation: () => void;
  clearTranslation: () => void;
}

let processCounter = 0;
let nonce = 0;

// Demo playback bookkeeping (see simStore for the pattern).
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

export const usePagingStore = create<PagingStore>((set, get) => ({
  state: createPagingState(TOTAL_MEMORY, DEFAULT_PAGE_SIZE),
  lastPlaced: [],
  lastFailure: null,
  failedRequests: 0,
  translationPid: null,
  logicalAddr: 0,
  translation: null,
  demoRunning: false,
  demoCaption: null,
  demoStep: 0,
  demoTotal: 0,

  allocateProcess: (size) => {
    const s = get();
    processCounter += 1;
    const pid = `P${processCounter}`;
    const res = pagingAllocate(s.state, {
      id: pid,
      size,
      color: colorForIndex(processCounter - 1),
      createdAt: Date.now(),
    });
    if (!res.ok) {
      processCounter -= 1;
      nonce += 1;
      set({
        failedRequests: s.failedRequests + 1,
        lastFailure: {
          size,
          freeFrames: res.freeFrames,
          needed: res.needed,
          nonce,
        },
      });
      return false;
    }
    set({
      state: res.state,
      lastPlaced: res.frames,
      lastFailure: null,
      translationPid: s.translationPid ?? pid,
    });
    return true;
  },

  killProcess: (pid) => {
    const s = get();
    const res = pagingFree(s.state, pid);
    if (!res) return;
    set({
      state: res.state,
      lastPlaced: [],
      ...(s.translationPid === pid
        ? { translationPid: null, translation: null }
        : {}),
    });
  },

  reset: (pageSize = DEFAULT_PAGE_SIZE) => {
    stopDemoTimer();
    demoPids = [];
    processCounter = 0;
    set({
      state: createPagingState(TOTAL_MEMORY, pageSize),
      lastPlaced: [],
      lastFailure: null,
      failedRequests: 0,
      translationPid: null,
      logicalAddr: 0,
      translation: null,
      demoRunning: false,
      demoCaption: null,
      demoStep: 0,
      demoTotal: 0,
    });
  },

  setDemo: (on) => {
    stopDemoTimer();
    if (!on) {
      set({ demoRunning: false, demoCaption: null, demoStep: 0, demoTotal: 0 });
      return;
    }

    // The script narrates 16 KB pages, so playback pins that page size.
    get().reset(16);
    const token = demoToken;
    const script = pagingDemoScript();
    set({ demoRunning: true, demoTotal: script.length });

    const execute = (step: DemoStep) => {
      if (step.kind === "alloc") {
        if (get().allocateProcess(step.size)) {
          demoPids.push(`P${processCounter}`);
        }
      } else if (step.kind === "kill") {
        const pid = demoPids[step.index];
        if (pid) get().killProcess(pid);
      } else if (step.kind === "translate") {
        const pid = demoPids[step.index];
        if (pid) {
          set({ translationPid: pid, logicalAddr: step.addr, translation: null });
          get().runTranslation();
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

    demoTimer = setTimeout(() => runFrom(0), 600);
  },

  setTranslationPid: (pid) =>
    set({ translationPid: pid, translation: null, logicalAddr: 0 }),

  setLogicalAddr: (addr) => set({ logicalAddr: addr, translation: null }),

  runTranslation: () => {
    const s = get();
    if (!s.translationPid) return;
    set({ translation: translate(s.state, s.translationPid, s.logicalAddr) });
  },

  clearTranslation: () => set({ translation: null }),
}));
