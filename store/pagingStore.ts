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

  allocateProcess: (size: number) => boolean;
  killProcess: (pid: string) => void;
  reset: (pageSize?: number) => void;
  setTranslationPid: (pid: string | null) => void;
  setLogicalAddr: (addr: number) => void;
  runTranslation: () => void;
  clearTranslation: () => void;
}

let processCounter = 0;
let nonce = 0;

export const usePagingStore = create<PagingStore>((set, get) => ({
  state: createPagingState(TOTAL_MEMORY, DEFAULT_PAGE_SIZE),
  lastPlaced: [],
  lastFailure: null,
  failedRequests: 0,
  translationPid: null,
  logicalAddr: 0,
  translation: null,

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
    processCounter = 0;
    set({
      state: createPagingState(TOTAL_MEMORY, pageSize),
      lastPlaced: [],
      lastFailure: null,
      failedRequests: 0,
      translationPid: null,
      logicalAddr: 0,
      translation: null,
    });
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
