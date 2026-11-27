import { LogoPicker } from "@/components/projects/LogoPicker";
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { updateProject } from "../actions";
import { requireUser } from "@/lib/auth/session";

export default async function ProjectSettingsPage({
  params,
  searchParams,
}: {
  params: { projectId: string };
  searchParams: { error?: string };
}) {
  await requireUser();

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
            <LogoPicker id="edit-logo" currentLogoUrl={project.logoUrl} />
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
