/**
 * Paging Mode engine: fixed frames, page tables, address translation.
 * Deliberately simpler than the contiguous allocator; the simplicity IS
 * the lesson (no fit strategies, no coalescing, no external fragmentation).
 */

export interface PagedProcess {
  id: string;
  /** Requested size in KB, needed for the internal fragmentation math. */
  size: number;
  color: string;
  createdAt: number;
}

export interface PagingState {
  totalMemory: number;
  pageSize: number; // KB per page/frame
  /** frame index -> owning processId, or null when free. */
  frames: (string | null)[];
  /** processId -> frame number for each page, in page order. */
  pageTables: Record<string, number[]>;
  processes: Record<string, PagedProcess>;
}

export function createPagingState(
  totalMemory: number,
  pageSize: number,
): PagingState {
  return {
    totalMemory,
    pageSize,
    frames: new Array(Math.floor(totalMemory / pageSize)).fill(null),
    pageTables: {},
    processes: {},
  };
}

export function pagesNeeded(size: number, pageSize: number): number {
  return Math.ceil(size / pageSize);
}

export type PagingAllocResult =
  | { ok: true; state: PagingState; frames: number[] }
  | { ok: false; reason: "out-of-memory"; freeFrames: number; needed: number };

/**
 * Allocate frames for a process. The only possible failure is genuinely
 * running out of frames; external fragmentation cannot happen here.
 */
export function pagingAllocate(
  state: PagingState,
  process: PagedProcess,
): PagingAllocResult {
  const needed = pagesNeeded(process.size, state.pageSize);
  const freeIdx: number[] = [];
  for (let i = 0; i < state.frames.length && freeIdx.length < needed; i++) {
    if (state.frames[i] === null) freeIdx.push(i);
  }

  const freeTotal = state.frames.filter((f) => f === null).length;
  if (freeIdx.length < needed) {
    return { ok: false, reason: "out-of-memory", freeFrames: freeTotal, needed };
  }

  const frames = state.frames.slice();
  for (const i of freeIdx) frames[i] = process.id;

  return {
    ok: true,
    frames: freeIdx,
    state: {
      ...state,
      frames,
      pageTables: { ...state.pageTables, [process.id]: freeIdx },
      processes: { ...state.processes, [process.id]: process },
    },
  };
}

/** Free every frame owned by the process. No coalescing needed, ever. */
export function pagingFree(
  state: PagingState,
  processId: string,
): { state: PagingState; freedFrames: number } | null {
  if (!state.processes[processId]) return null;

  const frames = state.frames.map((f) => (f === processId ? null : f));
  const pageTables = { ...state.pageTables };
  delete pageTables[processId];
  const processes = { ...state.processes };
  delete processes[processId];

  return {
    state: { ...state, frames, pageTables, processes },
    freedFrames: state.pageTables[processId]?.length ?? 0,
  };
}

/** Internal fragmentation: waste inside each process's last page. */
export function internalFragKB(state: PagingState, processId: string): number {
  const p = state.processes[processId];
  if (!p) return 0;
  return pagesNeeded(p.size, state.pageSize) * state.pageSize - p.size;
}

export function totalInternalFragKB(state: PagingState): number {
  return Object.keys(state.processes).reduce(
    (sum, pid) => sum + internalFragKB(state, pid),
    0,
  );
}

export type TranslationResult =
  | {
      ok: true;
      pageNo: number;
      offset: number;
      frameNo: number;
      physical: number;
    }
  | { ok: false; fault: "segfault"; limit: number };

/**
 * Logical -> physical address translation, returning every intermediate
 * so the UI can animate each step of the lookup.
 * Addresses are in KB to match the rest of the simulation.
 */
export function translate(
  state: PagingState,
  processId: string,
  logicalAddr: number,
): TranslationResult {
  const p = state.processes[processId];
  if (!p || logicalAddr >= p.size || logicalAddr < 0) {
    return { ok: false, fault: "segfault", limit: p ? p.size : 0 };
  }
  const pageNo = Math.floor(logicalAddr / state.pageSize);
  const offset = logicalAddr % state.pageSize;
  const frameNo = state.pageTables[processId][pageNo];
  return {
    ok: true,
    pageNo,
    offset,
    frameNo,
    physical: frameNo * state.pageSize + offset,
  };
}
