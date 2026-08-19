"use client";

import type { ReactNode } from "react";

/**
 * One instrument bar, cells divided by hairlines. Reads as a single
 * readout panel rather than a row of cards.
 */
export function StatBar({ children }: { children: ReactNode }) {
  return (
    <div className="mx-3 flex divide-x divide-border overflow-hidden rounded-lg border border-border bg-card/70">
      {children}
    </div>
  );
}

export function StatCell({
  label,
  value,
  unit,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  tone?: "default" | "warn" | "bad" | "good";
}) {
  const toneClass =
    tone === "warn"
      ? "text-warning"
      : tone === "bad"
        ? "text-destructive"
        : tone === "good"
          ? "text-primary"
          : "text-foreground";
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-px px-2.5 py-2">
      <span className="truncate whitespace-nowrap text-[9px] uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </span>
      <span className={`font-mono text-[15px] font-semibold leading-tight tabular ${toneClass}`}>
        {value}
        {unit && (
          <span className="ml-0.5 text-[10px] font-normal text-muted-foreground">
            {unit}
          </span>
        )}
      </span>
    </div>
  );
}
