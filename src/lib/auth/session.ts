import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { UserRole } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type CurrentUser = {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  isAdmin: boolean;
};

/**
 * Přihlášený uživatel, nebo null. Neověřuje jen podpis JWT (to dělá i
 * middleware), ale i to, že účet v databázi pořád existuje a přihlášení
 * nebylo zneplatněno (sessionVersion — změna hesla, role, odebrání
 * přístupu). Role se proto bere vždy čerstvě z DB, ne z tokenu.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, role: true, sessionVersion: true },
  });
  if (!user || user.sessionVersion !== (session.user.sessionVersion ?? 0)) return null;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    isAdmin: user.role === UserRole.ADMIN,
  };
}

/**
 * Povinná kontrola na začátku KAŽDÉ stránky, server action a route handleru
 * v chráněné části appky. Kontrola jen v layoutu nestačí — Next.js layout
 * při navigaci znovu nevykresluje, takže stránku jde načíst i bez něj.
 */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Jako requireUser, navíc jen pro adminy — ostatní pošle na homepage. */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!user.isAdmin) redirect("/");
  return user;
}
