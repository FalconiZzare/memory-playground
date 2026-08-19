"use client";

import { AnimatePresence, motion } from "motion/react";

/** Narration bar shown while a scripted demo is playing. */
export function DemoCaptionBar({
  caption,
  step,
  total,
}: {
  caption: string | null;
  step: number;
  total: number;
}) {
  return (
    <AnimatePresence initial={false}>
      {caption && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
          className="overflow-hidden"
        >
          <div className="flex items-start gap-2.5 rounded-md border border-warning/35 bg-warning/5 px-2.5 py-2">
            <span className="mt-px shrink-0 rounded-sm bg-warning/15 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-warning">
              Demo {step}/{total}
            </span>
            <AnimatePresence mode="wait" initial={false}>
              <motion.p
                key={caption}
                initial={{ opacity: 0, y: 3 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -3 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="min-w-0 flex-1 text-[11px] leading-snug text-foreground/90"
              >
                {caption}
              </motion.p>
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
