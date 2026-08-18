/**
 * Random event generator for auto-run mode. Pure: the caller supplies the
 * random source and the current process ids; the timer lives in the store.
 */

export type AutoEvent =
  | { type: "alloc"; size: number }
  | { type: "free"; processId: string };

/** 70% allocate a random 16..256 KB (multiple of 8), 30% free a random process. */
export function nextAutoEvent(
  rng: () => number,
  liveProcessIds: string[],
): AutoEvent {
  const wantsFree = rng() < 0.3 && liveProcessIds.length > 0;
  if (wantsFree) {
    const idx = Math.floor(rng() * liveProcessIds.length);
    return { type: "free", processId: liveProcessIds[idx] };
  }
  const steps = 2 + Math.floor(rng() * 31); // 2..32 steps of 8 KB = 16..256 KB
  return { type: "alloc", size: steps * 8 };
}
