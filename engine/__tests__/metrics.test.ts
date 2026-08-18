import { describe, expect, it } from "vitest";
import { computeMetrics } from "../metrics";
import { buildBlocks } from "./helpers";

describe("computeMetrics", () => {
  it("reports zero fragmentation when memory is full", () => {
    const m = computeMetrics(buildBlocks([[1024, "P1"]]), 1024);
    expect(m.totalFree).toBe(0);
    expect(m.fragmentation).toBe(0);
    expect(m.utilization).toBe(1);
    expect(m.holeCount).toBe(0);
  });

  it("reports zero fragmentation for a single hole", () => {
    const m = computeMetrics(buildBlocks([[512, "P1"], [512]]), 1024);
    expect(m.totalFree).toBe(512);
    expect(m.largestHole).toBe(512);
    expect(m.fragmentation).toBe(0);
    expect(m.holeCount).toBe(1);
  });

  it("computes fragmentation for scattered holes", () => {
    // Free: 64 + 64 + 128 = 256, largest 128 -> frag = 1 - 128/256 = 0.5
    const m = computeMetrics(
      buildBlocks([
        [64],
        [256, "P1"],
        [64],
        [256, "P2"],
        [128],
        [256, "P3"],
      ]),
      1024,
    );
    expect(m.totalFree).toBe(256);
    expect(m.largestHole).toBe(128);
    expect(m.fragmentation).toBeCloseTo(0.5);
    expect(m.holeCount).toBe(3);
    expect(m.utilization).toBeCloseTo(768 / 1024);
  });

  it("handles a completely free memory", () => {
    const m = computeMetrics(buildBlocks([[1024]]), 1024);
    expect(m.totalFree).toBe(1024);
    expect(m.fragmentation).toBe(0);
    expect(m.utilization).toBe(0);
  });
});
