import { beforeEach, describe, expect, it } from "vitest";
import {
  allocate,
  assertInvariants,
  chooseHole,
  coalesce,
  compact,
  createInitialBlocks,
  free,
} from "../allocator";
import { resetBlockIds } from "../ids";
import { buildBlocks, totalOf } from "./helpers";

beforeEach(() => resetBlockIds());

describe("createInitialBlocks", () => {
  it("creates a single free block spanning the whole space", () => {
    const blocks = createInitialBlocks(1024);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ start: 0, size: 1024, status: "free" });
    assertInvariants(blocks, 1024);
  });
});

describe("allocate: first-fit", () => {
  it("splits a larger hole, leaving the remainder free", () => {
    const blocks = createInitialBlocks(1024);
    const res = allocate(blocks, 128, "P1", "first-fit");
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.blocks).toHaveLength(2);
    expect(res.blocks[0]).toMatchObject({
      start: 0,
      size: 128,
      status: "occupied",
      processId: "P1",
    });
    expect(res.blocks[1]).toMatchObject({
      start: 128,
      size: 896,
      status: "free",
    });
    assertInvariants(res.blocks, 1024);
  });

  it("consumes a hole exactly with no remainder block", () => {
    const blocks = buildBlocks([[128], [896, "P9"]]);
    const res = allocate(blocks, 128, "P1", "first-fit");
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.blocks).toHaveLength(2);
    expect(res.blocks[0].status).toBe("occupied");
    assertInvariants(res.blocks, 1024);
  });

  it("picks the lowest-start hole that fits, not the best one", () => {
    // holes: 200 @0, 64 @264, 100 @392
    const blocks = buildBlocks([
      [200],
      [64, "P1"],
      [64],
      [64, "P2"],
      [100],
      [532, "P3"],
    ]);
    const res = allocate(blocks, 100, "PX", "first-fit");
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.placed.start).toBe(0);
  });

  it("fails with out-of-memory when total free < request", () => {
    const blocks = buildBlocks([[900, "P1"], [60], [64]]);
    const res = allocate(blocks, 200, "PX", "first-fit");
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toBe("out-of-memory");
    expect(res.totalFree).toBe(124);
  });

  it("fails with fragmentation when free >= request but no hole fits", () => {
    // Two 100 KB holes, request 150: the pedagogical money shot.
    const blocks = buildBlocks([
      [100],
      [400, "P1"],
      [100],
      [424, "P2"],
    ]);
    const res = allocate(blocks, 150, "PX", "first-fit");
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toBe("fragmentation");
    expect(res.totalFree).toBe(200);
    expect(res.largestHole).toBe(100);
  });
});

describe("allocate: best-fit and worst-fit", () => {
  // holes: 128 @0, 64 @192, 256 @320
  const layout = (): ReturnType<typeof buildBlocks> =>
    buildBlocks([
      [128],
      [64, "P1"],
      [64],
      [64, "P2"],
      [256],
      [448, "P3"],
    ]);

  it("best-fit picks the smallest hole that fits", () => {
    const res = allocate(layout(), 60, "PX", "best-fit");
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.placed.start).toBe(192); // the 64 KB hole
  });

  it("worst-fit picks the largest hole", () => {
    const res = allocate(layout(), 60, "PX", "worst-fit");
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.placed.start).toBe(320); // the 256 KB hole
  });

  it("best-fit tie breaks to the lowest start", () => {
    const blocks = buildBlocks([
      [100],
      [200, "P1"],
      [100],
      [624, "P2"],
    ]);
    const hole = chooseHole(blocks, 80, "best-fit");
    expect(hole?.start).toBe(0);
  });

  it("worst-fit tie breaks to the lowest start", () => {
    const blocks = buildBlocks([
      [300],
      [200, "P1"],
      [300],
      [224, "P2"],
    ]);
    const hole = chooseHole(blocks, 80, "worst-fit");
    expect(hole?.start).toBe(0);
  });
});

describe("free + coalescing", () => {
  it("frees with no free neighbors (no merge)", () => {
    const blocks = buildBlocks([
      [100, "P1"],
      [100, "P2"],
      [100, "P3"],
      [724, "P4"],
    ]);
    const res = free(blocks, "P2");
    expect(res).not.toBeNull();
    expect(res!.blocks).toHaveLength(4);
    expect(res!.blocks[1].status).toBe("free");
    expect(res!.blocks[1].processId).toBeUndefined();
    expect(res!.freedKB).toBe(100);
    assertInvariants(res!.blocks, 1024);
  });

  it("merges with a free left neighbor, keeping the left id", () => {
    const blocks = buildBlocks([[100], [100, "P1"], [824, "P2"]]);
    const leftId = blocks[0].id;
    const res = free(blocks, "P1")!;
    expect(res.blocks).toHaveLength(2);
    expect(res.blocks[0]).toMatchObject({
      id: leftId,
      start: 0,
      size: 200,
      status: "free",
    });
    assertInvariants(res.blocks, 1024);
  });

  it("merges with a free right neighbor, keeping the freed block's id", () => {
    const blocks = buildBlocks([[100, "P1"], [100], [824, "P2"]]);
    const freedId = blocks[0].id;
    const res = free(blocks, "P1")!;
    expect(res.blocks).toHaveLength(2);
    expect(res.blocks[0]).toMatchObject({ id: freedId, start: 0, size: 200 });
    assertInvariants(res.blocks, 1024);
  });

  it("merges both sides into one hole", () => {
    const blocks = buildBlocks([[100], [100, "P1"], [100], [724, "P2"]]);
    const res = free(blocks, "P1")!;
    expect(res.blocks).toHaveLength(2);
    expect(res.blocks[0]).toMatchObject({ start: 0, size: 300, status: "free" });
    assertInvariants(res.blocks, 1024);
  });

  it("returns null for an unknown process", () => {
    const blocks = buildBlocks([[1024, "P1"]]);
    expect(free(blocks, "P99")).toBeNull();
  });

  it("coalesce collapses any run of free blocks", () => {
    const blocks = buildBlocks([[100], [100], [100], [724, "P1"]]);
    const out = coalesce(blocks);
    expect(out).toHaveLength(2);
    expect(out[0].size).toBe(300);
  });
});

describe("compact", () => {
  it("packs occupied blocks from 0, preserving order and ids", () => {
    const blocks = buildBlocks([
      [64],
      [128, "P1"],
      [64],
      [128, "P2"],
      [640, "P3"],
    ]);
    const ids = blocks
      .filter((b) => b.status === "occupied")
      .map((b) => b.id);
    const res = compact(blocks);
    const occupied = res.blocks.filter((b) => b.status === "occupied");
    expect(occupied.map((b) => b.id)).toEqual(ids);
    expect(occupied.map((b) => b.start)).toEqual([0, 128, 256]);
    assertInvariants(res.blocks, 1024);
  });

  it("leaves exactly one trailing free block", () => {
    const blocks = buildBlocks([[64], [128, "P1"], [64], [768, "P2"]]);
    const res = compact(blocks);
    const holes = res.blocks.filter((b) => b.status === "free");
    expect(holes).toHaveLength(1);
    expect(holes[0].start).toBe(896);
    expect(holes[0].size).toBe(128);
  });

  it("reports moved KB as the total size of relocated blocks", () => {
    const blocks = buildBlocks([[64], [128, "P1"], [64], [128, "P2"], [640]]);
    const res = compact(blocks);
    // P1 moves 64->0, P2 moves 320->128: both relocate.
    expect(res.movedKB).toBe(256);
    expect(res.movedCount).toBe(2);
  });

  it("moves nothing when memory is already compact", () => {
    const blocks = buildBlocks([[128, "P1"], [128, "P2"], [768]]);
    const res = compact(blocks);
    expect(res.movedKB).toBe(0);
    expect(res.movedCount).toBe(0);
    assertInvariants(res.blocks, 1024);
  });

  it("handles a fully occupied space", () => {
    const blocks = buildBlocks([[512, "P1"], [512, "P2"]]);
    const res = compact(blocks);
    expect(res.blocks).toHaveLength(2);
    expect(totalOf(res.blocks)).toBe(1024);
    assertInvariants(res.blocks, 1024);
  });
});

describe("assertInvariants", () => {
  it("throws on a gap between blocks", () => {
    const blocks = buildBlocks([[100, "P1"], [924]]);
    blocks[1] = { ...blocks[1], start: 200 };
    expect(() => assertInvariants(blocks, 1024)).toThrow(/starts at/);
  });

  it("throws on adjacent free blocks", () => {
    const blocks = buildBlocks([[100], [100], [824, "P1"]]);
    expect(() => assertInvariants(blocks, 1024)).toThrow(/adjacent free/);
  });

  it("throws when blocks do not tile the total", () => {
    const blocks = buildBlocks([[100, "P1"], [100]]);
    expect(() => assertInvariants(blocks, 1024)).toThrow(/tile/);
  });
});
