import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { FolderKanban } from "lucide-react";
import { createProject } from "./actions";

export default async function ProjectsPage({ searchParams }: { searchParams: { error?: string } }) {
  const projects = await prisma.project.findMany({
    orderBy: { updatedAt: "desc" },
    include: { waves: { select: { id: true } } },
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Projekty</h1>
        <p className="mt-1 text-sm text-slate-500">Všechny projekty a rychlé založení nového.</p>
      </div>

      <Card>
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Nový projekt</h2>
        {searchParams.error && (
          <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{searchParams.error}</p>
        )}
        <form action={createProject} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="name">Název projektu</Label>
            <Input id="name" name="name" required />
          </div>
          <div>
            <Label htmlFor="client">Klient</Label>
            <Input id="client" name="client" required />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="description">Popis (nepovinné)</Label>
            <Textarea id="description" name="description" rows={3} />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit">Založit projekt</Button>
          </div>
        </form>
      </Card>

      {projects.length === 0 ? (
        <Card className="text-center text-sm text-slate-500">Zatím žádné projekty.</Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Link key={project.id} href={`/projects/${project.id}`}>
              <Card className="h-full cursor-pointer">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-blue-50 text-brand-blue-600">
                  <FolderKanban className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-slate-900">{project.name}</h3>
                <p className="mt-1 text-sm text-slate-500">{project.client}</p>
                <div className="mt-4">
                  <Badge tone="blue">
                    {project.waves.length} {project.waves.length === 1 ? "vlna" : "vln"}
                  </Badge>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
