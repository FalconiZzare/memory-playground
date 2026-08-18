"use client";

import { useMemo } from "react";
import { toast } from "sonner";
import { ChartLine, ListTree, Skull } from "lucide-react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip as ChartTooltip,
} from "recharts";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSimStore } from "@/store/simStore";
import type { LogEntry } from "@/engine/types";

function logTone(kind: LogEntry["kind"]): string {
  switch (kind) {
    case "alloc":
      return "text-primary";
    case "alloc-fail-frag":
      return "text-warning";
    case "alloc-fail-oom":
      return "text-destructive";
    case "free":
      return "text-foreground/80";
    case "compact":
      return "text-primary";
    default:
      return "text-muted-foreground";
  }
}

function ProcessRows() {
  const processes = useSimStore((s) => s.processes);
  const killProcess = useSimStore((s) => s.killProcess);
  const list = Object.values(processes).sort((a, b) => a.createdAt - b.createdAt);

  if (list.length === 0) {
    return (
      <p className="px-1 py-6 text-center text-sm text-muted-foreground">
        No live processes. Allocate one to get started.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-1">
      {list.map((p) => (
        <div
          key={p.id}
          className="flex items-center gap-2.5 rounded-md border border-border bg-card/60 px-2.5 py-2"
        >
          <span
            className="size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: p.color }}
          />
          <span className="font-mono text-sm font-semibold">{p.id}</span>
          <span className="font-mono text-xs text-muted-foreground tabular">
            {p.size} KB
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-7 px-2 text-destructive hover:text-destructive"
            onClick={() => {
              killProcess(p.id);
              toast(`${p.id} killed`, { description: `${p.size} KB freed` });
            }}
          >
            <Skull data-slot="icon" />
            Kill
          </Button>
        </div>
      ))}
    </div>
  );
}

function FragChart() {
  const stats = useSimStore((s) => s.stats);
  const data = useMemo(
    () =>
      stats.map((s) => ({
        op: s.op,
        frag: Math.round(s.fragmentation * 100),
        util: Math.round(s.utilization * 100),
      })),
    [stats],
  );

  if (data.length < 2) {
    return (
      <p className="px-1 py-6 text-center text-sm text-muted-foreground">
        Run a few operations and the fragmentation curve will draw itself.
      </p>
    );
  }
  return (
    <div className="h-52 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -22 }}>
          <XAxis
            dataKey="op"
            tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
          />
          <ChartTooltip
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelFormatter={(op) => `Operation ${op}`}
            formatter={(value, name) => [
              `${value}%`,
              name === "frag" ? "External fragmentation" : "Utilization",
            ]}
          />
          <Line
            type="monotone"
            dataKey="frag"
            stroke="var(--warning)"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="util"
            stroke="var(--primary)"
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
      <div className="flex justify-center gap-4 pt-1 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="h-0.5 w-3 bg-warning" /> fragmentation %
        </span>
        <span className="flex items-center gap-1">
          <span className="h-0.5 w-3 bg-primary" /> utilization %
        </span>
      </div>
    </div>
  );
}

export function InspectorDrawer() {
  const log = useSimStore((s) => s.log);

  return (
    <Drawer>
      <DrawerTrigger asChild>
        <Button
          variant="outline"
          className="mx-3 mb-2 h-8 justify-center gap-2 text-xs text-muted-foreground"
        >
          <ListTree data-slot="icon" />
          Inspector: processes, log, chart
          <ChartLine data-slot="icon" />
        </Button>
      </DrawerTrigger>
      <DrawerContent className="max-h-[85dvh]">
        <DrawerHeader className="pb-1">
          <DrawerTitle className="font-display">Inspector</DrawerTitle>
          <DrawerDescription>
            Live processes, the event log, and fragmentation over time.
          </DrawerDescription>
        </DrawerHeader>
        <Tabs defaultValue="processes" className="min-h-0 px-4 pb-6">
          <TabsList className="w-full">
            <TabsTrigger value="processes" className="flex-1">
              Processes
            </TabsTrigger>
            <TabsTrigger value="log" className="flex-1">
              Event log
            </TabsTrigger>
            <TabsTrigger value="chart" className="flex-1">
              Chart
            </TabsTrigger>
          </TabsList>
          <TabsContent value="processes" className="mt-2">
            <ScrollArea className="h-64">
              <ProcessRows />
            </ScrollArea>
          </TabsContent>
          <TabsContent value="log" className="mt-2">
            <ScrollArea className="h-64">
              <div className="flex flex-col gap-1 font-mono text-[11px] leading-relaxed">
                {[...log].reverse().map((e) => (
                  <div key={e.id} className="flex gap-2">
                    <span className="shrink-0 text-muted-foreground/60 tabular">
                      {new Date(e.time).toLocaleTimeString([], {
                        hour12: false,
                      })}
                    </span>
                    <span className={logTone(e.kind)}>{e.message}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
          <TabsContent value="chart" className="mt-2">
            <FragChart />
          </TabsContent>
        </Tabs>
      </DrawerContent>
    </Drawer>
  );
}
