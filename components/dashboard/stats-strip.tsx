"use client";

import { StatBar, StatCell } from "./stat-bar";
import { useMetrics, useSimStore } from "@/store/simStore";

export function StatsStrip() {
  const m = useMetrics();
  const failed = useSimStore((s) => s.failedRequests);
  const fragPct = Math.round(m.fragmentation * 100);

  return (
    <StatBar>
      <StatCell label="Free" value={m.totalFree} unit="KB" />
      <StatCell label="Max hole" value={m.largestHole} unit="KB" />
      <StatCell
        label="Ext. frag"
        value={`${fragPct}%`}
        tone={fragPct >= 40 ? "bad" : fragPct > 0 ? "warn" : "good"}
      />
      <StatCell
        label="Failed"
        value={failed}
        tone={failed > 0 ? "bad" : "default"}
      />
    </StatBar>
  );
}
