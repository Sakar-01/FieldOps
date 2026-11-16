"use client";

import { createColumnHelper } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { DataTable, dataTableFeatures } from "@/components/shared/data-table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { api, errorMessage } from "@/lib/http/client";
import type { UserDto } from "@/lib/services/auth";

const helper = createColumnHelper<typeof dataTableFeatures, UserDto>();

const ROLE_LABELS: Record<UserDto["role"], string> = {
  owner: "Owner",
  dispatcher: "Dispatcher",
  technician: "Technician",
};

export function TeamTable({ members }: { members: UserDto[] }) {
  const router = useRouter();
  const [toDeactivate, setToDeactivate] = useState<UserDto | null>(null);

  async function setActive(member: UserDto, active: boolean) {
    try {
      await api(`/api/team/${member.id}`, { method: "PATCH", body: { active } });
      toast.success(`${member.name} ${active ? "reactivated" : "deactivated"}`);
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  const columns = [
    helper.accessor("name", { header: "Name" }),
    helper.accessor("email", { header: "Email" }),
    helper.accessor("phone", { header: "Phone", cell: ({ getValue }) => getValue() || "-" }),
    helper.accessor("role", {
      header: "Role",
      cell: ({ getValue }) => <Badge variant="secondary">{ROLE_LABELS[getValue()]}</Badge>,
    }),
    helper.display({
      id: "active",
      header: "Active",
      cell: ({ row }) => {
        const member = row.original;
        // The owner can't be deactivated, so there's no control to offer.
        if (member.role === "owner") return <span className="text-sm">Yes</span>;
        return (
          <Switch
            checked={member.active}
            aria-label={`${member.name} is active`}
            onCheckedChange={(checked) =>
              checked ? setActive(member, true) : setToDeactivate(member)
            }
          />
        );
      },
    }),
  ];

  return (
    <>
      <DataTable
        columns={columns}
        data={members}
        getRowId={(member) => member.id}
        caption="Team members"
      />
      <AlertDialog
        open={toDeactivate !== null}
        onOpenChange={(open) => !open && setToDeactivate(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate {toDeactivate?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              They&apos;ll be logged out immediately and won&apos;t be able to log in or be assigned
              jobs. You can reactivate them later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => toDeactivate && setActive(toDeactivate, false)}>
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
