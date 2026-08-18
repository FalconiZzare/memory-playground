import type { MemoryBlock } from "./types";

export interface Metrics {
  totalFree: number;
  totalOccupied: number;
  utilization: number; // 0..1
  largestHole: number;
  holeCount: number;
  /**
   * External fragmentation: 1 - largestHole / totalFree.
   * Reads as "the share of free memory that is unusable for a request
   * larger than the largest hole". 0 when memory is full or free space
   * is one contiguous hole.
   */
  fragmentation: number; // 0..1
}

export function computeMetrics(
  blocks: MemoryBlock[],
  totalMemory: number,
): Metrics {
  let totalFree = 0;
  let largestHole = 0;
  let holeCount = 0;

  for (const b of blocks) {
    if (b.status === "free") {
      totalFree += b.size;
      holeCount += 1;
      if (b.size > largestHole) largestHole = b.size;
    }
  }

  const totalOccupied = totalMemory - totalFree;
  const fragmentation = totalFree === 0 ? 0 : 1 - largestHole / totalFree;

  return {
    totalFree,
    totalOccupied,
    utilization: totalMemory === 0 ? 0 : totalOccupied / totalMemory,
    largestHole,
    holeCount,
    fragmentation,
  };
}
