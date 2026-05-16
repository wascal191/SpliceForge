import { getBedsheet } from "@/lib/actions/bedsheets";
import { getPages } from "@/lib/actions/pages";
import { CanvasLayout } from "@/components/canvas/CanvasLayout";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

export default async function CanvasPage({
  params,
}: {
  params: Promise<{ bedsheetId: string }>;
}) {
  const { bedsheetId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let bedsheet;
  try {
    bedsheet = await getBedsheet(bedsheetId);
  } catch {
    notFound();
  }

  let pages = await getPages(bedsheetId);
  if (pages.length === 0) {
    // First open of a fresh bedsheet — seed Page 1. We can't call the
    // createPage server action here because it calls revalidatePath, which
    // Next.js 16 forbids during server-component render. Direct insert is
    // fine: getBedsheet above already confirmed the bedsheet is in the
    // caller's org, so we trust bedsheet.organization_id.
    const { data: newPage, error: seedErr } = await supabase
      .from("pages")
      .insert({
        bedsheet_id: bedsheetId,
        page_index: 0,
        title: "Page 1",
        organization_id: (bedsheet as { organization_id: string }).organization_id,
      })
      .select()
      .single();
    if (seedErr || !newPage) {
      // eslint-disable-next-line no-console
      console.error("[canvas.page.seedFirstPage]", seedErr);
      throw new Error("Could not initialize bedsheet");
    }
    pages = [newPage];
  }

  return (
    <CanvasLayout
      bedsheet={bedsheet}
      initialPages={pages}
      userName={(user?.user_metadata?.full_name as string | undefined) ?? null}
      userEmail={user?.email ?? null}
    />
  );
}
