import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getProjects, getProjectStats } from "@/lib/actions/projects";
import {
  getCurrentOrganization,
  getCurrentUserRole,
  type Organization,
} from "@/lib/actions/organizations";
import { auth } from "@/lib/auth";
import { maybeOne, withTransaction } from "@/lib/db";
import { applyTemplate } from "@/lib/templates/apply";
import { ftthAccess } from "@/lib/templates/ftth-access";
import { DashboardClient } from "@/components/dashboard/DashboardClient";

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");
  const user = session.user;

  let [projects, stats, org] = await Promise.all([
    getProjects(),
    getProjectStats(),
    getCurrentOrganization(),
  ]);
  let role = await getCurrentUserRole();

  // Recovery: user authenticated but no organization linked. This can happen
  // if the signup page completed account creation but the createOrganization
  // call failed (network blip, etc). Auto-provision a workspace + seed the
  // demo FTTH project so the user lands on a populated canvas.
  if (!org) {
    const workspaceName = `${user.name || user.email || "My"}'s workspace`;
    try {
      org = await maybeOne<Organization>(
        `SELECT * FROM create_org_with_owner($1, $2)`,
        [workspaceName, user.id]
      );
      if (org) {
        const orgId = org.id;
        await withTransaction(async (tx) => {
          const projRes = await tx.query<{ id: string }>(
            `INSERT INTO projects (name, description, organization_id)
               VALUES ($1, $2, $3)
             RETURNING id`,
            [
              ftthAccess.defaultProjectName,
              "Demo project — try the BFS trace and export tools on this seeded FTTH network.",
              orgId,
            ]
          );
          const projectId = projRes.rows[0]?.id;
          if (projectId) {
            await applyTemplate(tx, orgId, projectId, ftthAccess);
          }
        });
        [projects, stats] = await Promise.all([getProjects(), getProjectStats()]);
        role = await getCurrentUserRole();
      }
    } catch {
      // Recovery failed; dashboard will render without an org and the user
      // can retry from the UI.
    }
  }

  return (
    <DashboardClient
      initialProjects={projects ?? []}
      totalFibers={stats.totalFibers}
      totalCables={stats.totalCables}
      userEmail={user.email ?? null}
      userName={user.name ?? null}
      organization={org ? { id: org.id, name: org.name } : null}
      currentUserRole={role}
    />
  );
}
