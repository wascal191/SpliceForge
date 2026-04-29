import { getBedsheet } from "@/lib/actions/bedsheets";
import { getPages, createPage } from "@/lib/actions/pages";
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
    const newPage = await createPage(bedsheetId, 0, "Page 1");
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
