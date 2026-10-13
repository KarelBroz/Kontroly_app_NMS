"use server";

import { requireAdmin, requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { BugReportStatus } from "@prisma/client";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

/**
 * Nahlásí chybu z libovolné stránky appky (kulatá vlaječka vpravo dole,
 * viz BugReportButton) — po uložení přesměruje zpátky přesně tam, odkud
 * uživatel hlásil (pageUrl), se stejným "?saved=" toast vzorem jako jinde.
 */
export async function createBugReport(formData: FormData) {
  const user = await requireUser();
  const rawPageUrl = String(formData.get("pageUrl") || "/").trim();
  // jen cesta uvnitř appky — "//jiny-web.cz" nebo "https://..." by po
  // nahlášení přesměrovalo ven
  const pageUrl = /^\/(?![\/\\])/.test(rawPageUrl) ? rawPageUrl : "/";
  const message = String(formData.get("message") || "").trim();

  // textarea má "required", takhle se sem dá dostat jen obejitím formuláře -
  // tichý no-op stačí, není potřeba speciální chybová hláška
  if (!message) {
    redirect(pageUrl);
  }

  await prisma.bugReport.create({
    data: { userId: user.id, pageUrl, message },
  });

  revalidatePath("/bug-reports");
  redirect(`${pageUrl}?saved=${encodeURIComponent("Nahlášeno, díky!")}`);
}

export async function updateBugReportStatus(bugReportId: string, status: BugReportStatus, _formData: FormData) {
  await requireAdmin();
  await prisma.bugReport.update({ where: { id: bugReportId }, data: { status } });
  revalidatePath("/bug-reports");
  redirect(`/bug-reports?saved=${encodeURIComponent("Stav aktualizován")}`);
}
