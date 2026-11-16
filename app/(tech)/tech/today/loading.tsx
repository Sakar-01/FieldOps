import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-lg space-y-3" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-7 w-40" />
      <Skeleton className="h-36 w-full" />
      <Skeleton className="h-36 w-full" />
    </div>
  );
}
