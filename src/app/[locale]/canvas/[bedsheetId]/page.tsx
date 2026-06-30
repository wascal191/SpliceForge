import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getBedsheet } from "@/lib/actions/bedsheets";
import { getPages } from "@/lib/actions/pages";
import { CanvasLayout } from "@/components/canvas/CanvasLayout";
import { auth } from "@/lib/auth";
import { maybeOne } from "@/lib/db";

type Page = {
  id: string;
  organization_id: string;
  bedsheet_id: string;
  page_index: number;
  title: string | null;
  data_json: Record<string, unknown> | null;
  created_at: string;
};

export default async function CanvasPage({
  params,
}: {
  params: Promise<{ bedsheetId: string }>;
}) {
  const { bedsheetId } = await params;

  const session = await auth.api.getSession({ headers: await headers() });
  const user = session?.user ?? null;

  let bedsheet;
  try {
    bedsheet = await getBedsheet(bedsheetId);
  } catch {
    notFound();
  }
  if (!bedsheet) notFound();

  let pages = await getPages(bedsheetId);
  if (!pages || pages.length === 0) {
    const orgId = (bedsheet as { organization_id: string }).organization_id;
    try {
      const newPage = await maybeOne<Page>(
        `INSERT INTO pages (bedsheet_id, page_index, title, organization_id)
           VALUES ($1, 0, 'Page 1', $2)
         RETURNING *`,
        [bedsheetId, orgId]
      );
      if (!newPage) throw new Error("Insert returned no row");
      pages = [newPage];
    } catch (seedErr) {
      console.error("[canvas.page.seedFirstPage]", seedErr);
      throw new Error("Could not initialize bedsheet");
    }
  }

  return (
    <CanvasLayout
      bedsheet={bedsheet}
      initialPages={pages}
      userName={user?.name ?? null}
      userEmail={user?.email ?? null}
    />
  );
}
