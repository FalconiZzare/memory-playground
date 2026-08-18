/**
 * Stamps a unique build id into the exported service worker so every
 * deploy gets a fresh cache name and clients pick up the new version
 * on their next normal page load (no hard refresh needed).
 * Runs automatically as part of `npm run build`.
 */
import { readFileSync, writeFileSync } from "node:fs";

const path = "out/sw.js";
const id = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);

const src = readFileSync(path, "utf8");
if (!src.includes("__BUILD_ID__")) {
  console.error("stamp-sw: placeholder __BUILD_ID__ not found in out/sw.js");
  process.exit(1);
}
writeFileSync(path, src.replaceAll("__BUILD_ID__", id));
console.log(`stamp-sw: cache version memplayground-${id}`);
