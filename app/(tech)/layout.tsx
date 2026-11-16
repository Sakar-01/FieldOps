import { CalendarIcon } from "lucide-react";
import Link from "next/link";
import { ChangePasswordDialog } from "@/components/shared/change-password-dialog";
import { LogoutButton } from "@/components/shared/logout-button";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { requirePageRole } from "@/lib/auth/current-user";

export default async function TechLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requirePageRole(["technician"]);

  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex h-14 items-center gap-2 border-b px-4">
        <span className="truncate font-semibold">{user.name}</span>
        <span className="ml-auto" />
        <ChangePasswordDialog />
        <ThemeToggle />
        <LogoutButton />
      </header>
      <main className="flex-1 p-4 pb-20">{children}</main>
      <nav
        aria-label="Main"
        className="bg-background fixed inset-x-0 bottom-0 flex justify-around border-t"
      >
        {/* min-h-11 keeps the touch target at the required 44 px. */}
        <Link href="/tech/today" className="flex min-h-11 flex-col items-center p-2 text-xs">
          <CalendarIcon className="size-5" />
          Today
        </Link>
      </nav>
    </div>
  );
}
