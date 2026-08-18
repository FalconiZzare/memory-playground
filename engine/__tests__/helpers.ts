import type { MemoryBlock } from "../types";

let n = 0;

/**
 * Build a tiled block list from [size, processId?] tuples.
 * A tuple without a processId is a free hole.
 */
export function buildBlocks(
  spec: Array<[number, string?]>,
): MemoryBlock[] {
  let start = 0;
  return spec.map(([size, pid]) => {
    n += 1;
    const b: MemoryBlock = {
      id: `t${n}`,
      start,
      size,
      status: pid ? "occupied" : "free",
      ...(pid ? { processId: pid } : {}),
    };
    start += size;
    return b;
  });
}

export function totalOf(blocks: MemoryBlock[]): number {
  return blocks.reduce((s, b) => s + b.size, 0);
}
