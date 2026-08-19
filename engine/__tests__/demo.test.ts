import { describe, expect, it } from "vitest";
import { allocate, compact, createInitialBlocks, free } from "../allocator";
import {
  createPagingState,
  pagingAllocate,
  pagingFree,
  translate,
} from "../paging";
import { contigDemoScript, pagingDemoScript } from "../demo";
import type { MemoryBlock, Strategy } from "../types";

/*
 * The scripted demos are choreography over the real engine. These tests
 * replay each script and pin the moments the captions narrate, so an
 * engine or script change that would make a caption lie fails loudly.
 */

function replayContig(strategy: Strategy) {
  let blocks: MemoryBlock[] = createInitialBlocks(1024);
  const pids: string[] = [];
  let counter = 0;
  const placements: (number | null)[] = [];
  const failures: (string | null)[] = [];

  for (const step of contigDemoScript(strategy)) {
    if (step.kind === "alloc") {
      const pid = `P${counter + 1}`;
      const res = allocate(blocks, step.size, pid, strategy);
      if (res.ok) {
        counter += 1;
        pids.push(pid);
        blocks = res.blocks;
        placements.push(res.placed.start);
        failures.push(null);
      } else {
        placements.push(null);
        failures.push(res.reason);
      }
    } else if (step.kind === "kill") {
      const res = free(blocks, pids[step.index]);
      expect(res, `kill index ${step.index} must hit a live process`).not.toBeNull();
      blocks = res!.blocks;
    } else if (step.kind === "compact") {
      blocks = compact(blocks).blocks;
    }
  }
  return { placements, failures };
}

describe("contiguous demo script", () => {
  // Allocation steps in script order: setup x7, strategy moment, fail, retry.
  const STRATEGY_MOMENT = 7; // 8th alloc step
  const FAIL = 8;
  const RETRY = 9;

  const expectedStart: Record<Strategy, number> = {
    "first-fit": 0, // first hole that fits (192 KB at 0)
    "best-fit": 256, // exact 96 KB hole
    "worst-fit": 416, // largest hole (256 KB)
  };

  for (const strategy of ["first-fit", "best-fit", "worst-fit"] as Strategy[]) {
    it(`reveals ${strategy} placement and the fragmentation finale`, () => {
      const { placements, failures } = replayContig(strategy);
      expect(placements[STRATEGY_MOMENT]).toBe(expectedStart[strategy]);
      expect(failures[FAIL]).toBe("fragmentation");
      expect(placements[RETRY]).not.toBeNull();
    });
  }
});

describe("paging demo script", () => {
  it("scatters P5 across two gaps and translates address 130 as narrated", () => {
    let state = createPagingState(1024, 16);
    const pids: string[] = [];
    let counter = 0;
    let lastFrames: number[] = [];

    for (const step of pagingDemoScript()) {
      if (step.kind === "alloc") {
        counter += 1;
        const pid = `P${counter}`;
        const res = pagingAllocate(state, {
          id: pid,
          size: step.size,
          color: "#000",
          createdAt: 0,
        });
        expect(res.ok, `demo alloc of ${step.size} KB must succeed`).toBe(true);
        if (res.ok) {
          state = res.state;
          pids.push(pid);
          lastFrames = res.frames;
        }
      } else if (step.kind === "kill") {
        const res = pagingFree(state, pids[step.index]);
        expect(res).not.toBeNull();
        state = res!.state;
      } else if (step.kind === "translate") {
        const t = translate(state, pids[step.index], step.addr);
        expect(t).toEqual({
          ok: true,
          pageNo: 8,
          offset: 2,
          frameNo: 25,
          physical: 402,
        });
      }
    }

    // P5 (180 KB, 12 frames) fills P1's old 7-frame gap plus 5 more from
    // P4's gap: visibly scattered, as the caption claims.
    expect(lastFrames).toEqual([0, 1, 2, 3, 4, 5, 6, 24, 25, 26, 27, 28]);
  });
});
