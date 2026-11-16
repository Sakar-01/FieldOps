"use client";

import { LogOutIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api, errorMessage } from "@/lib/http/client";

export function LogoutButton() {
  const router = useRouter();

  async function logout() {
    try {
      await api("/api/auth/logout", { method: "POST" });
      router.replace("/login");
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  return (
    <Button variant="ghost" size="icon" aria-label="Log out" onClick={logout}>
      <LogOutIcon />
    </Button>
  );
}
