/**
 * Core domain types for the memory simulation.
 * Pure TypeScript: no React, no browser APIs.
 */

export type Strategy = "first-fit" | "best-fit" | "worst-fit";

export interface MemoryBlock {
  /** Stable id, required for layout animations to track blocks across moves. */
  id: string;
  /** KB offset from the start of physical memory. */
  start: number;
  /** Size in KB. */
  size: number;
  status: "free" | "occupied";
  /** Set when occupied. */
  processId?: string;
}

export interface Process {
  id: string; // "P1", "P2", ...
  size: number; // requested KB
  color: string; // stable palette color assigned at creation
  createdAt: number;
}

export type LogKind =
  | "alloc"
  | "alloc-fail-frag"
  | "alloc-fail-oom"
  | "free"
  | "compact"
  | "strategy"
  | "reset"
  | "info";

export interface LogEntry {
  id: number;
  time: number;
  kind: LogKind;
  message: string;
}

export interface StatsSnapshot {
  /** Monotonic operation counter, used as the chart x-axis. */
  op: number;
  time: number;
  totalFree: number;
  totalOccupied: number;
  utilization: number; // 0..1
  largestHole: number;
  holeCount: number;
  fragmentation: number; // 0..1 external fragmentation
}

export type AllocFailure = {
  ok: false;
  /**
   * "fragmentation": total free >= size but no single hole fits.
   * "out-of-memory": total free < size.
   */
  reason: "fragmentation" | "out-of-memory";
  totalFree: number;
  largestHole: number;
};

export type AllocSuccess = {
  ok: true;
  blocks: MemoryBlock[];
  /** The occupied block that was created. */
  placed: MemoryBlock;
};

export type AllocResult = AllocSuccess | AllocFailure;

export interface CompactResult {
  blocks: MemoryBlock[];
  /** Total KB of occupied memory that changed position. */
  movedKB: number;
  /** How many blocks were relocated. */
  movedCount: number;
}

/** 12-color, index-assigned process palette (colorblind-aware ordering). */
export const PROCESS_PALETTE = [
  "#5B8DEF", // blue
  "#F2A65A", // orange
  "#9B7EDE", // violet
  "#4FC1B0", // teal
  "#E8719E", // pink
  "#C9CE58", // olive
  "#5FB2E6", // sky
  "#D98E68", // clay
  "#7FA85C", // moss
  "#B586C9", // lilac
  "#E3B341", // gold
  "#6E8FA6", // slate
] as const;

export function colorForIndex(i: number): string {
  return PROCESS_PALETTE[i % PROCESS_PALETTE.length];
}
