import { getProjects, getProjectStats } from "@/lib/actions/projects";
import { getCurrentOrganization, getCurrentUserRole, type Organization } from "@/lib/actions/organizations";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DashboardClient } from "@/components/dashboard/DashboardClient";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  let [projects, stats, org] = await Promise.all([
    getProjects(),
    getProjectStats(),
    getCurrentOrganization(),
  ]);
  const role = await getCurrentUserRole();

  // Recovery: user authenticated but no org linked (auth/callback didn't
  // complete provisioning, e.g. RPC was missing on first signup). We can't
  // call the createOrganization server action here because it calls
  // revalidatePath, which Next.js 16 forbids during server-component render.
  // Invoke the RPC directly via the admin client — same end result.
  if (!org) {
    const companyName = (user.user_metadata?.company_name as string | undefined) ?? "My Organization";
    try {
      const admin = createAdminClient();
      const { data: newOrg, error: rpcError } = await admin.rpc("create_org_with_owner", {
        p_name: companyName,
        p_user_id: user.id,
      });
      if (!rpcError && newOrg) {
        org = newOrg as Organization;
        [projects, stats] = await Promise.all([getProjects(), getProjectStats()]);
      }
    } catch {
      // org creation failed; dashboard will render without org
    }
  }

  return (
    <DashboardClient
      initialProjects={projects}
      totalFibers={stats.totalFibers}
      totalCables={stats.totalCables}
      userEmail={user?.email ?? null}
      userName={(user?.user_metadata?.full_name as string | undefined) ?? null}
      organization={org ? { id: org.id, name: org.name, plan: org.plan ?? "free" } : null}
      currentUserRole={role}
    />
  );
}
