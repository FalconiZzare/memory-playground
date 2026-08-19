"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HomeScreen } from "@/components/home/home-screen";
import { ThemeToggle } from "@/components/theme-toggle";
import { RamGrid } from "@/components/ram-grid/ram-grid";
import { StatsStrip } from "@/components/dashboard/stats-strip";
import { AllocControls } from "@/components/controls/alloc-controls";
import { InspectorDrawer } from "@/components/dashboard/inspector-drawer";
import { FrameGrid } from "@/components/paging/frame-grid";
import { PagingControls } from "@/components/paging/paging-controls";
import { AddressTranslator } from "@/components/paging/address-translator";
import { useSimStore } from "@/store/simStore";
import { usePagingStore } from "@/store/pagingStore";
import type { Strategy } from "@/engine/types";

const STRATEGIES: { value: Strategy; label: string }[] = [
  { value: "first-fit", label: "First fit" },
  { value: "best-fit", label: "Best fit" },
  { value: "worst-fit", label: "Worst fit" },
];

function StrategyTabs() {
  const strategy = useSimStore((s) => s.strategy);
  const setStrategy = useSimStore((s) => s.setStrategy);
  return (
    <Tabs
      value={strategy}
      onValueChange={(v) => setStrategy(v as Strategy)}
      className="px-3"
    >
      <TabsList className="h-8 w-full">
        {STRATEGIES.map((s) => (
          <TabsTrigger
            key={s.value}
            value={s.value}
            className="flex-1 font-mono text-[10px] uppercase tracking-[0.12em] data-[state=active]:font-semibold"
          >
            {s.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

export default function Home() {
  const pageSize = usePagingStore((s) => s.state.pageSize);
  const [view, setView] = useState<"home" | "sim">("home");
  const [mode, setMode] = useState<"contiguous" | "paging">("contiguous");

  if (view === "home") {
    return (
      <div className="mx-auto flex h-dvh w-full max-w-lg flex-col overflow-hidden border-border/60 pt-[env(safe-area-inset-top)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] sm:border-x">
        <HomeScreen
          onEnter={(m) => {
            setMode(m);
            setView("sim");
          }}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-dvh w-full max-w-lg flex-col overflow-hidden border-border/60 pt-[env(safe-area-inset-top)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] sm:border-x">
      <Tabs
        value={mode}
        onValueChange={(v) => setMode(v as "contiguous" | "paging")}
        className="flex min-h-0 flex-1 flex-col gap-2"
      >
        <header className="flex items-center justify-between px-3 pt-3">
          <h1 className="font-display text-base font-semibold tracking-tight">
            <button
              onClick={() => setView("home")}
              aria-label="Back to home"
              className="transition-transform duration-150 ease-out active:scale-[0.97]"
            >
              Mem<span className="text-primary">Playground</span>
              <span className="animate-cursor ml-0.5 inline-block h-[0.85em] w-[0.45em] translate-y-[0.08em] bg-primary/80" />
            </button>
            <span className="ml-2 rounded-sm border border-border px-1 py-px font-mono text-[9px] font-normal tracking-wide text-muted-foreground">
              1024 KB
            </span>
          </h1>
          <div className="flex items-center gap-1.5">
            <TabsList className="h-8">
              <TabsTrigger value="contiguous" className="px-3 text-xs">
                Contiguous
              </TabsTrigger>
              <TabsTrigger value="paging" className="px-3 text-xs">
                Paging
              </TabsTrigger>
            </TabsList>
            <ThemeToggle />
          </div>
        </header>

        <TabsContent
          value="contiguous"
          className="flex min-h-0 flex-1 flex-col gap-2 data-[state=inactive]:hidden"
        >
          <StrategyTabs />
          <RamGrid />
          <StatsStrip />
          <InspectorDrawer />
          <AllocControls />
        </TabsContent>

        <TabsContent
          value="paging"
          className="min-h-0 flex-1 data-[state=inactive]:hidden"
        >
          <div className="flex h-full flex-col gap-2.5 overflow-y-auto pb-[env(safe-area-inset-bottom)]">
            <p className="px-3 text-[11px] leading-snug text-muted-foreground">
              Fixed {pageSize} KB frames, no contiguity required. External
              fragmentation is structurally impossible; the trade-off is
              internal waste in each process&apos;s last page (hatched red).
            </p>
            <FrameGrid />
            <PagingControls />
            <AddressTranslator />
            <div className="h-2 shrink-0" />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
