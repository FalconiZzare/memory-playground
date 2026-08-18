"use client";

import { useEffect } from "react";

/**
 * Registers the runtime-caching service worker.
 * Registration only happens in production builds so `next dev` stays
 * cache-free while iterating.
 */
export function RegisterSW() {
  useEffect(() => {
    if (
      process.env.NODE_ENV === "production" &&
      "serviceWorker" in navigator
    ) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Offline support is progressive enhancement; failure is non-fatal.
      });
    }
  }, []);
  return null;
}
