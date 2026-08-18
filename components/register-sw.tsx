"use client";

import { useEffect } from "react";

/**
 * Registers the runtime-caching service worker.
 * Registration only happens in production builds so `next dev` stays
 * cache-free while iterating.
 *
 * Update flow: the worker calls skipWaiting/clients.claim, so a new
 * deploy activates immediately. The page itself was still rendered
 * from the old cache, so when the new worker takes control we reload
 * once to pick up the new assets. The `hadController` guard skips the
 * reload on the very first install (no old version to replace).
 */
export function RegisterSW() {
  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" ||
      !("serviceWorker" in navigator)
    ) {
      return;
    }

    let hadController = !!navigator.serviceWorker.controller;
    const onControllerChange = () => {
      if (!hadController) {
        hadController = true;
        return;
      }
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      onControllerChange,
    );

    const registration = navigator.serviceWorker
      .register("/sw.js")
      .catch(() => null);

    // Installed PWAs can stay open for days without a navigation, so the
    // browser's built-in update check never runs. Re-check whenever the
    // app comes back to the foreground.
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        registration.then((reg) => reg?.update().catch(() => {}));
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        onControllerChange,
      );
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  return null;
}
