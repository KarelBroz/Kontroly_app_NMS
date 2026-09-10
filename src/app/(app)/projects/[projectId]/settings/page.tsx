import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { ImagePlus } from "lucide-react";
import { updateProject } from "../actions";

export default async function ProjectSettingsPage({
  params,
  searchParams,
}: {
  params: { projectId: string };
  searchParams: { error?: string };
}) {
  const project = await prisma.project.findUnique({ where: { id: params.projectId } });

  if (!project) notFound();

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-medium text-brand-blue-600">
          <Link href={`/projects/${project.id}`}>← {project.name}</Link>
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">Upravit projekt</h1>
      </div>

      {searchParams.error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{searchParams.error}</p>
      )}

      <Card className="max-w-3xl">
        <form action={updateProject.bind(null, project.id)} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="edit-name">Název projektu</Label>
            <Input id="edit-name" name="name" defaultValue={project.name} required />
          </div>
          <div>
            <Label htmlFor="edit-client">Klient</Label>
            <Input id="edit-client" name="client" defaultValue={project.client} required />
          </div>
          <div>
            <Label htmlFor="edit-code">Kód projektu Intranet</Label>
            <Input id="edit-code" name="code" defaultValue={project.code ?? ""} placeholder="CZ26222" required />
          </div>
          <div>
            <Label htmlFor="edit-navigatorCode">Kód projektu Navigátor</Label>
            <Input id="edit-navigatorCode" name="navigatorCode" defaultValue={project.navigatorCode ?? ""} />
          </div>
          <div>
            <Label htmlFor="edit-projectManager">Projektový manažer</Label>
            <Input
              id="edit-projectManager"
              name="projectManager"
              defaultValue={project.projectManager ?? ""}
              required
            />
          </div>
          <div>
            <Label htmlFor="edit-accountManager">Account manager</Label>
            <Input
              id="edit-accountManager"
              name="accountManager"
              defaultValue={project.accountManager ?? ""}
              required
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="edit-description">Popis (nepovinné)</Label>
            <Textarea id="edit-description" name="description" rows={3} defaultValue={project.description ?? ""} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="edit-logo">Logo firmy</Label>
            <label
              htmlFor="edit-logo"
              className="mt-1 flex cursor-pointer items-center gap-4 rounded-xl border border-dashed border-slate-300 p-4 hover:border-brand-blue-400 hover:bg-brand-blue-50/40"
            >
              {project.logoUrl ? (
                <>
                  {/* data URL logo — plain <img>, next/image nemá pro data: URL smysl */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={project.logoUrl}
                    alt="Logo"
                    className="h-12 w-12 shrink-0 rounded-lg border border-slate-200 bg-white object-contain"
                  />
                  <span className="text-sm text-slate-600">
                    Logo úspěšně nahráno, kliknutím můžete logo změnit
                  </span>
                </>
              ) : (
                <>
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                    <ImagePlus className="h-5 w-5" />
                  </div>
                  <span className="text-sm text-slate-600">Nahrát logo</span>
                </>
              )}
              <input id="edit-logo" name="logo" type="file" accept="image/*" className="hidden" />
            </label>
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" variant="secondary">
              Uložit změny
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
