"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createProject } from "@/lib/actions/projects";
import { createBedsheet } from "@/lib/actions/bedsheets";
import {
  createProjectFromTemplate,
  listTemplates,
} from "@/lib/actions/templates";

type Step = "choose" | "blank" | "template";

type TemplateSummary = {
  id: string;
  name: string;
  description: string;
  elementCount: number;
  spliceCount: number;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

// Maps template id -> translation key under "templates"
function templateNameKey(id: string): "ftthAccess" | "contractorSplice" | null {
  if (id === "ftth-access") return "ftthAccess";
  if (id === "contractor-splice") return "contractorSplice";
  return null;
}

export function NewProjectWizard({ open, onOpenChange }: Props) {
  const t = useTranslations("dashboard.wizard");
  const tTemplates = useTranslations("templates");
  const router = useRouter();
  const [step, setStep] = useState<Step>("choose");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [templateId, setTemplateId] = useState<string>("ftth-access");
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep("choose");
    setName("");
    setDescription("");
    setError(null);
    setBusy(false);
    listTemplates().then(setTemplates).catch(() => setTemplates([]));
  }, [open]);

  function close() {
    if (busy) return;
    onOpenChange(false);
  }

  async function handleBlank(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const project = await createProject(name.trim(), description.trim() || undefined);
      const bs = await createBedsheet(project!.id, "Sheet 1");
      onOpenChange(false);
      router.push(`/canvas/${bs.id}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  async function handleTemplate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !templateId || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await createProjectFromTemplate(
        name.trim(),
        templateId,
        description.trim() || undefined
      );
      onOpenChange(false);
      router.push(`/canvas/${result.bedsheetId}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  function localizedTemplate(s: TemplateSummary) {
    const key = templateNameKey(s.id);
    if (!key) return { name: s.name, description: s.description };
    return {
      name: tTemplates(`${key}.name`),
      description: tTemplates(`${key}.description`),
    };
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : close())}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {step === "choose" && t("newProject")}
            {step === "blank" && t("startBlank")}
            {step === "template" && t("chooseTemplate")}
          </DialogTitle>
        </DialogHeader>

        {step === "choose" && (
          <div className="flex flex-col gap-3 pt-1">
            <p className="text-sm text-muted-foreground">{t("howStart")}</p>
            <WizardCard
              title={t("startBlank")}
              subtitle={t("startBlankSubtitle")}
              onClick={() => setStep("blank")}
            />
            <WizardCard
              title={t("fromTemplate")}
              subtitle={t("fromTemplateSubtitle")}
              onClick={() => setStep("template")}
            />
          </div>
        )}

        {step === "blank" && (
          <form onSubmit={handleBlank} className="flex flex-col gap-4">
            <ProjectNameFields
              t={t}
              name={name}
              setName={setName}
              description={description}
              setDescription={setDescription}
            />
            {error && <p className="text-destructive text-sm">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setStep("choose")} disabled={busy}>
                {t("back")}
              </Button>
              <Button type="submit" disabled={!name.trim() || busy}>
                {busy ? t("creating") : t("createProject")}
              </Button>
            </DialogFooter>
          </form>
        )}

        {step === "template" && (
          <form onSubmit={handleTemplate} className="flex flex-col gap-4">
            <ProjectNameFields
              t={t}
              name={name}
              setName={setName}
              description={description}
              setDescription={setDescription}
            />
            <div className="flex flex-col gap-2">
              <Label>{t("template")}</Label>
              <div className="flex flex-col gap-2">
                {templates.map((tpl) => {
                  const active = templateId === tpl.id;
                  const loc = localizedTemplate(tpl);
                  return (
                    <button
                      type="button"
                      key={tpl.id}
                      onClick={() => setTemplateId(tpl.id)}
                      className={`text-left rounded border px-3 py-2 transition ${
                        active
                          ? "border-primary bg-primary/5"
                          : "border-input hover:border-muted-foreground/40"
                      }`}
                    >
                      <div className="text-sm font-medium">{loc.name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {loc.description}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-1 font-mono">
                        {t("elementsAndSplices", {
                          elements: tpl.elementCount,
                          splices: tpl.spliceCount,
                        })}
                      </div>
                    </button>
                  );
                })}
                {templates.length === 0 && (
                  <p className="text-xs text-muted-foreground">{t("loadingTemplates")}</p>
                )}
              </div>
            </div>
            {error && <p className="text-destructive text-sm">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setStep("choose")} disabled={busy}>
                {t("back")}
              </Button>
              <Button type="submit" disabled={!name.trim() || !templateId || busy}>
                {busy ? t("building") : t("createFromTemplate")}
              </Button>
            </DialogFooter>
          </form>
        )}

      </DialogContent>
    </Dialog>
  );
}

function WizardCard({
  title,
  subtitle,
  onClick,
}: {
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left rounded-lg border border-input px-4 py-3 hover:border-primary hover:bg-primary/5 transition"
    >
      <div className="text-sm font-semibold">{title}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{subtitle}</div>
    </button>
  );
}

function ProjectNameFields({
  t,
  name,
  setName,
  description,
  setDescription,
}: {
  t: (k: string) => string;
  name: string;
  setName: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
}) {
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="wiz-name">{t("name")}</Label>
        <Input
          id="wiz-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("namePlaceholder")}
          autoFocus
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="wiz-desc">{t("description")}</Label>
        <Input
          id="wiz-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t("descriptionPlaceholder")}
        />
      </div>
    </>
  );
}
