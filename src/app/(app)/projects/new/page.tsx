import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { ImagePlus } from "lucide-react";
import { createProject } from "../actions";

export default function NewProjectPage({ searchParams }: { searchParams: { error?: string } }) {
  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-medium text-brand-blue-600">
          <Link href="/projects">← Projekty</Link>
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">Nový projekt</h1>
      </div>

      <Card className="max-w-3xl">
        <p className="mb-4 text-sm text-slate-500">
          Údaje (název, kód projektu) se musí shodovat s názvy projektu v Intranetu.
        </p>
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
          <div>
            <Label htmlFor="code">Kód projektu Intranet</Label>
            <Input id="code" name="code" placeholder="CZ26222" required />
          </div>
          <div>
            <Label htmlFor="navigatorCode">Kód projektu Navigátor</Label>
            <Input id="navigatorCode" name="navigatorCode" />
          </div>
          <div>
            <Label htmlFor="projectManager">Projektový manažer</Label>
            <Input id="projectManager" name="projectManager" required />
          </div>
          <div>
            <Label htmlFor="accountManager">Account manager</Label>
            <Input id="accountManager" name="accountManager" required />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="description">Popis (nepovinné)</Label>
            <Textarea id="description" name="description" rows={3} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="logo">Logo firmy (nepovinné)</Label>
            <label
              htmlFor="logo"
              className="mt-1 flex cursor-pointer items-center gap-4 rounded-xl border border-dashed border-slate-300 p-4 hover:border-brand-blue-400 hover:bg-brand-blue-50/40"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                <ImagePlus className="h-5 w-5" />
              </div>
              <span className="text-sm text-slate-600">Nahrát logo</span>
              <input id="logo" name="logo" type="file" accept="image/*" className="hidden" />
            </label>
          </div>
          <div className="sm:col-span-2">
            <Button type="submit">Založit projekt</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
