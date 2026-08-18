import { describe, expect, it } from "vitest";
import {
  createPagingState,
  internalFragKB,
  pagesNeeded,
  pagingAllocate,
  pagingFree,
  totalInternalFragKB,
  translate,
  type PagedProcess,
} from "../paging";

const proc = (id: string, size: number): PagedProcess => ({
  id,
  size,
  color: "#000",
  createdAt: 0,
});

describe("createPagingState", () => {
  it("creates 64 free frames for 1024 KB at 16 KB pages", () => {
    const s = createPagingState(1024, 16);
    expect(s.frames).toHaveLength(64);
    expect(s.frames.every((f) => f === null)).toBe(true);
  });
});

describe("pagingAllocate", () => {
  it("allocates ceil(size/pageSize) frames", () => {
    const s = createPagingState(1024, 16);
    const res = pagingAllocate(s, proc("P1", 100));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.frames).toHaveLength(7); // ceil(100/16)
    expect(res.state.pageTables["P1"]).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it("scatters across free frames with no contiguity requirement", () => {
    const s = createPagingState(1024, 16);
    const a = pagingAllocate(s, proc("P1", 32)); // frames 0,1
    if (!a.ok) throw new Error();
    const b = pagingAllocate(a.state, proc("P2", 32)); // frames 2,3
    if (!b.ok) throw new Error();
    const freed = pagingFree(b.state, "P1")!; // holes at 0,1
    const c = pagingAllocate(freed.state, proc("P3", 48)); // needs 3 frames
    expect(c.ok).toBe(true);
    if (!c.ok) return;
    expect(c.frames).toEqual([0, 1, 4]); // scattered: the point of paging
  });

  it("fails only when free frames < pages needed", () => {
    const s = createPagingState(64, 16); // 4 frames
    const a = pagingAllocate(s, proc("P1", 40)); // 3 frames
    if (!a.ok) throw new Error();
    const b = pagingAllocate(a.state, proc("P2", 32)); // needs 2, only 1 free
    expect(b.ok).toBe(false);
    if (b.ok) return;
    expect(b.reason).toBe("out-of-memory");
    expect(b.freeFrames).toBe(1);
    expect(b.needed).toBe(2);
  });
});

describe("pagingFree", () => {
  it("clears frames and drops the page table", () => {
    const s = createPagingState(1024, 16);
    const a = pagingAllocate(s, proc("P1", 100));
    if (!a.ok) throw new Error();
    const res = pagingFree(a.state, "P1")!;
    expect(res.freedFrames).toBe(7);
    expect(res.state.frames.every((f) => f === null)).toBe(true);
    expect(res.state.pageTables["P1"]).toBeUndefined();
    expect(res.state.processes["P1"]).toBeUndefined();
  });

  it("returns null for an unknown process", () => {
    expect(pagingFree(createPagingState(1024, 16), "P9")).toBeNull();
  });
});

describe("internal fragmentation", () => {
  it("is zero for an exact page multiple", () => {
    const s = createPagingState(1024, 16);
    const a = pagingAllocate(s, proc("P1", 64)); // exactly 4 pages
    if (!a.ok) throw new Error();
    expect(internalFragKB(a.state, "P1")).toBe(0);
  });

  it("is pageSize - 1 for a 1 KB process (max waste)", () => {
    const s = createPagingState(1024, 16);
    const a = pagingAllocate(s, proc("P1", 1));
    if (!a.ok) throw new Error();
    expect(internalFragKB(a.state, "P1")).toBe(15);
  });

  it("matches the classroom example: 100 KB at 16 KB pages wastes 12 KB", () => {
    const s = createPagingState(1024, 16);
    const a = pagingAllocate(s, proc("P1", 100));
    if (!a.ok) throw new Error();
    expect(pagesNeeded(100, 16)).toBe(7);
    expect(internalFragKB(a.state, "P1")).toBe(12); // 7*16 - 100
  });

  it("totals waste across processes", () => {
    const s = createPagingState(1024, 16);
    const a = pagingAllocate(s, proc("P1", 100)); // 12 waste
    if (!a.ok) throw new Error();
    const b = pagingAllocate(a.state, proc("P2", 30)); // 2 waste
    if (!b.ok) throw new Error();
    expect(totalInternalFragKB(b.state)).toBe(14);
  });
});

describe("translate", () => {
  const setup = () => {
    const s = createPagingState(1024, 16);
    const a = pagingAllocate(s, proc("P1", 100)); // frames 0..6
    if (!a.ok) throw new Error();
    return a.state;
  };

  it("translates a mid-page address", () => {
    const r = translate(setup(), "P1", 37);
    expect(r).toEqual({
      ok: true,
      pageNo: 2, // floor(37/16)
      offset: 5, // 37 mod 16
      frameNo: 2,
      physical: 2 * 16 + 5,
    });
  });

  it("translates at a page start (offset 0)", () => {
    const r = translate(setup(), "P1", 32);
    if (!r.ok) throw new Error();
    expect(r.pageNo).toBe(2);
    expect(r.offset).toBe(0);
  });

  it("translates at a page end (offset pageSize - 1)", () => {
    const r = translate(setup(), "P1", 47);
    if (!r.ok) throw new Error();
    expect(r.pageNo).toBe(2);
    expect(r.offset).toBe(15);
  });

  it("faults on an address past the process size", () => {
    const r = translate(setup(), "P1", 100); // size is 100, valid range 0..99
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.fault).toBe("segfault");
    expect(r.limit).toBe(100);
  });

  it("faults on a negative address and unknown process", () => {
    expect(translate(setup(), "P1", -1).ok).toBe(false);
    expect(translate(setup(), "P9", 0).ok).toBe(false);
  });

  it("uses scattered frames correctly after free + realloc", () => {
    const s = createPagingState(1024, 16);
    const a = pagingAllocate(s, proc("PA", 32)); // frames 0,1
    if (!a.ok) throw new Error();
    const b = pagingAllocate(a.state, proc("PB", 32)); // frames 2,3
    if (!b.ok) throw new Error();
    const freed = pagingFree(b.state, "PA")!;
    const c = pagingAllocate(freed.state, proc("PC", 48)); // frames 0,1,4
    if (!c.ok) throw new Error();
    const r = translate(c.state, "PC", 40); // page 2 -> frame 4, offset 8
    if (!r.ok) throw new Error();
    expect(r.frameNo).toBe(4);
    expect(r.physical).toBe(4 * 16 + 8);
  });
});
