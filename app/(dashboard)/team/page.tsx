import type { Metadata } from "next";
import { AddMemberDialog } from "@/components/team/add-member-dialog";
import { TeamTable } from "@/components/team/team-table";
import { requirePageRole } from "@/lib/auth/current-user";
import { OWNER_ONLY } from "@/lib/auth/require-role";
import { listTeam } from "@/lib/services/team";

export const metadata: Metadata = { title: "Team" };

export default async function TeamPage() {
  const { context } = await requirePageRole(OWNER_ONLY);
  const members = await listTeam(context);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Team</h1>
        <AddMemberDialog />
      </div>
      <TeamTable members={members} />
      {members.length === 1 && (
        <p className="text-muted-foreground text-sm">
          It&apos;s just you so far. Add a technician or dispatcher to get started.
        </p>
      )}
    </div>
  );
}
