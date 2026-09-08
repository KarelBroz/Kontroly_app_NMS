import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Button } from "@/components/ui/Button";
import { Layers } from "lucide-react";
import { createWave } from "./actions";

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: { projectId: string };
  searchParams: { error?: string };
}) {
  const project = await prisma.project.findUnique({
    where: { id: params.projectId },
    include: {
      waves: {
        orderBy: { createdAt: "desc" },
        include: { visits: { select: { id: true } }, importBatches: { select: { id: true } } },
      },
    },
  });

  if (!project) notFound();

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-medium text-brand-blue-600">
          <Link href="/projects">← Projekty</Link>
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">{project.name}</h1>
        <p className="mt-1 text-sm text-slate-500">{project.client}</p>
        {project.description && <p className="mt-2 max-w-2xl text-sm text-slate-600">{project.description}</p>}
      </div>

      <Card>
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Nová vlna</h2>
        {searchParams.error && (
          <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{searchParams.error}</p>
        )}
        <form action={createWave.bind(null, project.id)} className="flex flex-wrap items-end gap-4">
          <div className="min-w-[200px] flex-1">
            <Label htmlFor="name">Název vlny</Label>
            <Input id="name" name="name" placeholder="např. Q1 2026" required />
          </div>
          <Button type="submit">Založit vlnu</Button>
        </form>
      </Card>

      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Vlny</h2>
        {project.waves.length === 0 ? (
          <Card className="text-center text-sm text-slate-500">Zatím žádné vlny.</Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {project.waves.map((wave) => (
              <Link key={wave.id} href={`/projects/${project.id}/waves/${wave.id}`}>
                <Card className="h-full cursor-pointer">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-green-50 text-brand-green-600">
                    <Layers className="h-5 w-5" />
                  </div>
                  <h3 className="font-semibold text-slate-900">{wave.name}</h3>
                  <div className="mt-4 flex gap-2">
                    <Badge tone="neutral">{wave.visits.length} návštěv</Badge>
                    <Badge tone="neutral">{wave.importBatches.length} importů</Badge>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
