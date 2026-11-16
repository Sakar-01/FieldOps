import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { ChangePasswordDialog } from "@/components/shared/change-password-dialog";
import { LogoutButton } from "@/components/shared/logout-button";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { OFFICE_ROLES } from "@/lib/auth/require-role";
import { requirePageRole } from "@/lib/auth/current-user";
import { businessesRepo } from "@/lib/db/repositories/businesses";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { context, user } = await requirePageRole(OFFICE_ROLES);
  const business = await businessesRepo.findById(context.businessId);

  return (
    <SidebarProvider>
      <AppSidebar role={context.role} businessName={business?.name ?? ""} />
      <SidebarInset>
        <header className="flex h-14 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <span className="text-muted-foreground ml-auto truncate text-sm">{user.name}</span>
          <ChangePasswordDialog />
          <ThemeToggle />
          <LogoutButton />
        </header>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
