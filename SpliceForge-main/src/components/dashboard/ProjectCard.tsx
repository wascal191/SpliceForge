"use client";

import { useState } from "react";
import { BedsheetList } from "./BedsheetList";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

type Project = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
};

export function ProjectCard({
  project,
  onDelete,
}: {
  project: Project;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <button className="flex-1 text-left" onClick={() => setExpanded((v) => !v)}>
            <CardTitle className="text-base">{project.name}</CardTitle>
            {project.description && (
              <p className="text-muted-foreground text-sm mt-0.5">{project.description}</p>
            )}
          </button>
          <Button
            size="sm"
            variant="ghost"
            className="text-xs text-destructive hover:text-destructive shrink-0"
            onClick={() => onDelete(project.id)}
          >
            Delete
          </Button>
        </div>
      </CardHeader>

      {expanded && (
        <>
          <Separator />
          <CardContent className="pt-3">
            <BedsheetList projectId={project.id} />
          </CardContent>
        </>
      )}
    </Card>
  );
}
