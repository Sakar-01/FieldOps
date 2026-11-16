"use client";

import { BriefcaseIcon, ContactIcon, LayoutDashboardIcon, UsersIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import type { Role } from "@/lib/db/types";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboardIcon, ownerOnly: false },
  { href: "/jobs", label: "Jobs", icon: BriefcaseIcon, ownerOnly: false },
  { href: "/customers", label: "Customers", icon: ContactIcon, ownerOnly: false },
  { href: "/team", label: "Team", icon: UsersIcon, ownerOnly: true },
];

export function AppSidebar({ role, businessName }: { role: Role; businessName: string }) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((item) => !item.ownerOnly || role === "owner");

  return (
    <Sidebar>
      <SidebarHeader>
        <p className="px-2 py-1 font-semibold">FieldOps</p>
        <p className="text-muted-foreground truncate px-2 text-xs">{businessName}</p>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={pathname.startsWith(item.href)}>
                    <Link href={item.href}>
                      <item.icon />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
