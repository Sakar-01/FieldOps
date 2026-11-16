"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { homeFor } from "@/lib/auth/route-access";
import { api, errorMessage } from "@/lib/http/client";
import type { UserDto } from "@/lib/services/auth";
import { cn } from "cn";

type DemoRole = "owner" | "technician";

/** "Try as" buttons that open the shared demo business (FR-AUTH-06). */
export function DemoButtons({
  variant = "secondary",
  size,
  className,
}: {
  variant?: "default" | "secondary" | "outline";
  size?: "default" | "lg";
  className?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<DemoRole | null>(null);

  async function tryDemo(role: DemoRole) {
    setPending(role);
    try {
      const { user } = await api<{ user: UserDto }>("/api/auth/demo", { body: { role } });
      router.replace(homeFor(user.role));
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
      setPending(null);
    }
  }

  return (
    <div className={cn("grid grid-cols-2 gap-2", className)}>
      {(["owner", "technician"] as const).map((role) => (
        <Button
          key={role}
          type="button"
          variant={variant}
          size={size}
          disabled={pending !== null}
          onClick={() => tryDemo(role)}
        >
          {pending === role ? "Opening..." : `Try as ${role === "owner" ? "Owner" : "Technician"}`}
        </Button>
      ))}
    </div>
  );
}
