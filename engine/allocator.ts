import { nextBlockId } from "./ids";
import type {
  AllocResult,
  CompactResult,
  MemoryBlock,
  Strategy,
} from "./types";

/** A fresh memory map: one free block spanning the whole space. */
export function createInitialBlocks(totalMemory: number): MemoryBlock[] {
  return [
    { id: nextBlockId(), start: 0, size: totalMemory, status: "free" },
  ];
}

function freeHoles(blocks: MemoryBlock[]): MemoryBlock[] {
  return blocks.filter((b) => b.status === "free");
}

export function totalFreeKB(blocks: MemoryBlock[]): number {
  return freeHoles(blocks).reduce((sum, b) => sum + b.size, 0);
}

export function largestHoleKB(blocks: MemoryBlock[]): number {
  return freeHoles(blocks).reduce((max, b) => Math.max(max, b.size), 0);
}

/**
 * Pick a hole for `size` under the given strategy.
 * Blocks are always sorted by start, so "first in scan order" is first fit,
 * and ties on size resolve to the lowest start naturally via strict `<`/`>`.
 */
export function chooseHole(
  blocks: MemoryBlock[],
  size: number,
  strategy: Strategy,
): MemoryBlock | null {
  const candidates = freeHoles(blocks).filter((b) => b.size >= size);
  if (candidates.length === 0) return null;

  switch (strategy) {
    case "first-fit":
      return candidates[0];
    case "best-fit":
      return candidates.reduce((best, b) => (b.size < best.size ? b : best));
    case "worst-fit":
      return candidates.reduce((worst, b) => (b.size > worst.size ? b : worst));
  }
}

/**
 * Allocate `size` KB for `processId`. Never mutates.
 * Failure distinguishes external fragmentation from genuine out-of-memory.
 */
export function allocate(
  blocks: MemoryBlock[],
  size: number,
  processId: string,
  strategy: Strategy,
): AllocResult {
  const free = totalFreeKB(blocks);
  const hole = chooseHole(blocks, size, strategy);

  if (!hole) {
    return {
      ok: false,
      reason: free >= size ? "fragmentation" : "out-of-memory",
      totalFree: free,
      largestHole: largestHoleKB(blocks),
    };
  }

  const placed: MemoryBlock = {
    id: nextBlockId(),
    start: hole.start,
    size,
    status: "occupied",
    processId,
  };

  const next: MemoryBlock[] = [];
  for (const b of blocks) {
    if (b.id !== hole.id) {
      next.push(b);
      continue;
    }
    next.push(placed);
    const remainder = hole.size - size;
    if (remainder > 0) {
      next.push({
        id: nextBlockId(),
        start: hole.start + size,
        size: remainder,
        status: "free",
      });
    }
  }
  return { ok: true, blocks: next, placed };
}

/**
 * Free the block owned by `processId` and coalesce with free neighbors.
 * The merged block keeps the LEFT-most participating block's id so layout
 * animations read as the left neighbor growing.
 * Returns null if the process owns no block.
 */
export function free(
  blocks: MemoryBlock[],
  processId: string,
): { blocks: MemoryBlock[]; freedKB: number } | null {
  const idx = blocks.findIndex(
    (b) => b.status === "occupied" && b.processId === processId,
  );
  if (idx === -1) return null;

  const target = blocks[idx];
  const next = blocks.map((b) =>
    b.id === target.id
      ? { id: b.id, start: b.start, size: b.size, status: "free" as const }
      : b,
  );

  return { blocks: coalesce(next), freedKB: target.size };
}

/** Merge every run of adjacent free blocks into one (keeps left-most id). */
export function coalesce(blocks: MemoryBlock[]): MemoryBlock[] {
  const out: MemoryBlock[] = [];
  for (const b of blocks) {
    const prev = out[out.length - 1];
    if (prev && prev.status === "free" && b.status === "free") {
      out[out.length - 1] = { ...prev, size: prev.size + b.size };
    } else {
      out.push(b);
    }
  }
  return out;
}

/**
 * Slide all occupied blocks to the bottom of memory, preserving order and
 * ids, leaving a single trailing free block. Tracks relocation cost.
 */
export function compact(blocks: MemoryBlock[]): CompactResult {
  const occupied = blocks.filter((b) => b.status === "occupied");
  const total = blocks.reduce((sum, b) => sum + b.size, 0);

  let cursor = 0;
  let movedKB = 0;
  let movedCount = 0;
  const packed: MemoryBlock[] = occupied.map((b) => {
    const moved = b.start !== cursor;
    if (moved) {
      movedKB += b.size;
      movedCount += 1;
    }
    const nb = { ...b, start: cursor };
    cursor += b.size;
    return nb;
  });

  const remaining = total - cursor;
  if (remaining > 0) {
    // Reuse the id of the first free block so the hole reads as one
    // surviving block in animations rather than a brand-new element.
    const firstFree = blocks.find((b) => b.status === "free");
    packed.push({
      id: firstFree ? firstFree.id : nextBlockId(),
      start: cursor,
      size: remaining,
      status: "free",
    });
  }

  return { blocks: packed, movedKB, movedCount };
}

/** Dev-only sanity checks for the invariants documented in CLAUDE.md. */
export function assertInvariants(
  blocks: MemoryBlock[],
  totalMemory: number,
): void {
  let expectedStart = 0;
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (b.start !== expectedStart) {
      throw new Error(
        `Invariant violated: block ${b.id} starts at ${b.start}, expected ${expectedStart}`,
      );
    }
    if (b.size <= 0) {
      throw new Error(`Invariant violated: block ${b.id} has size ${b.size}`);
    }
    const prev = blocks[i - 1];
    if (prev && prev.status === "free" && b.status === "free") {
      throw new Error(
        `Invariant violated: adjacent free blocks ${prev.id} and ${b.id}`,
      );
    }
    expectedStart += b.size;
  }
  if (expectedStart !== totalMemory) {
    throw new Error(
      `Invariant violated: blocks tile ${expectedStart} KB, expected ${totalMemory} KB`,
    );
  }
}
