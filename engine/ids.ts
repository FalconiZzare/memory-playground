/**
 * Tiny deterministic id factory for memory blocks.
 * A module counter keeps the engine free of crypto/browser APIs and
 * makes test output reproducible when reset between tests.
 */

let counter = 0;

export function nextBlockId(): string {
  counter += 1;
  return `b${counter}`;
}

export function resetBlockIds(): void {
  counter = 0;
}
