"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  createBedsheet,
  getBedsheets,
  renameBedsheet,
  deleteBedsheet,
} from "@/lib/actions/bedsheets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Bedsheet = {
  id: string;
  name: string;
  project_id: string;
  created_at: string;
};

export function BedsheetList({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [bedsheets, setBedsheets] = useState<Bedsheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [creating, setCreating] = useState(false);

  async function load() {
    try {
      const data = await getBedsheets(projectId);
      setBedsheets(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [projectId]);

  async function handleCreate() {
    setCreating(true);
    try {
      const data = await createBedsheet(projectId, `Sheet ${bedsheets.length + 1}`);
      router.push(`/canvas/${data.id}`);
    } catch (err) {
      alert((err as Error).message);
      setCreating(false);
    }
  }

  async function commitRename(id: string) {
    if (!renameValue.trim()) { setRenamingId(null); return; }
    try {
      await renameBedsheet(id, renameValue.trim());
      await load();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setRenamingId(null);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteBedsheet(id);
      await load();
    } catch (err) {
      alert((err as Error).message);
    }
  }

  if (loading) return <p className="text-muted-foreground text-sm">Loading…</p>;

  return (
    <div className="flex flex-col gap-1 pl-2">
      {bedsheets.map((bs) => (
        <div key={bs.id} className="flex items-center gap-2 group">
          {renamingId === bs.id ? (
            <Input
              className="h-7 text-sm flex-1"
              value={renameValue}
              autoFocus
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={() => commitRename(bs.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename(bs.id);
                if (e.key === "Escape") setRenamingId(null);
              }}
            />
          ) : (
            <button
              className="flex-1 text-left text-sm py-1 px-2 rounded hover:bg-accent truncate"
              onClick={() => router.push(`/canvas/${bs.id}`)}
            >
              {bs.name}
            </button>
          )}
          <div className="hidden group-hover:flex gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-1.5 text-xs"
              onClick={() => { setRenamingId(bs.id); setRenameValue(bs.name); }}
            >
              Rename
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-1.5 text-xs text-destructive hover:text-destructive"
              onClick={() => handleDelete(bs.id)}
            >
              Delete
            </Button>
          </div>
        </div>
      ))}
      <Button
        size="sm"
        variant="outline"
        className="mt-1 w-fit"
        onClick={handleCreate}
        disabled={creating}
      >
        {creating ? "Creating…" : "+ New Bedsheet"}
      </Button>
    </div>
  );
}
