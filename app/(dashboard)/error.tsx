"use client";

import { Button } from "@/components/ui/button";

export default function DashboardError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-start gap-3" role="alert">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="text-muted-foreground text-sm">This page couldn&apos;t be loaded.</p>
      <Button variant="outline" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
