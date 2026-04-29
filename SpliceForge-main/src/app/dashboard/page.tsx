import { getProjects, getProjectStats } from "@/lib/actions/projects";
import { getCurrentOrganization, createOrganization, getCurrentUserRole } from "@/lib/actions/organizations";
import { createClient } from "@/lib/supabase/server";
import { DashboardClient } from "@/components/dashboard/DashboardClient";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  let [projects, stats, org, role] = await Promise.all([
    getProjects(),
    getProjectStats(),
    getCurrentOrganization(),
    getCurrentUserRole(),
  ]);

  // Recovery: user authenticated but no org linked — create one from signup metadata
  if (!org) {
    const companyName = (user.user_metadata?.company_name as string | undefined) ?? "My Organization";
    try {
      org = await createOrganization(companyName);
      [projects, stats] = await Promise.all([getProjects(), getProjectStats()]);
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
