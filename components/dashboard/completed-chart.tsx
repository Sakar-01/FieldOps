"use client";

import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

const config = {
  completed: { label: "Completed", color: "var(--chart-1)" },
} satisfies ChartConfig;

/**
 * FR-DASH-02. One series, so one hue and no legend; the card title names it. Horizontal bars
 * keep long names readable, and each bar carries its value so the chart reads without hover.
 */
export function CompletedChart({ data }: { data: { name: string; completed: number }[] }) {
  if (data.length === 0) {
    return (
      <p className="text-muted-foreground py-8 text-center text-sm">
        No jobs completed yet this week.
      </p>
    );
  }
  return (
    <ChartContainer
      config={config}
      className="w-full"
      style={{ height: Math.max(120, data.length * 44 + 24) }}
      aria-label="Jobs completed per technician this week"
    >
      <BarChart data={data} layout="vertical" margin={{ left: 0, right: 32 }} barCategoryGap={8}>
        <CartesianGrid horizontal={false} strokeDasharray="2 4" />
        <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
        <YAxis
          type="category"
          dataKey="name"
          width={110}
          tickLine={false}
          axisLine={false}
          tick={{ fill: "var(--foreground)" }}
        />
        <ChartTooltip
          cursor={{ fill: "var(--muted)" }}
          content={<ChartTooltipContent hideLabel={false} />}
        />
        <Bar
          dataKey="completed"
          fill="var(--color-completed)"
          radius={[0, 4, 4, 0]}
          maxBarSize={28}
        >
          <LabelList
            dataKey="completed"
            position="right"
            className="fill-foreground"
            fontSize={12}
          />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
