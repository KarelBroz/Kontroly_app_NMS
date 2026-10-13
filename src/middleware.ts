import { withAuth } from "next-auth/middleware";

/**
 * Vstupní brána celé appky: bez platného přihlášení (podepsaný JWT v cookie)
 * se požadavek vůbec nedostane ke stránce, server action ani exportu —
 * přesměruje se na /login. Platí pro každý typ požadavku včetně interních
 * RSC požadavků Next.js, které obcházely kontrolu v layoutu.
 *
 * Je to první vrstva; druhá (requireUser/requireAdmin v každé stránce
 * a akci, src/lib/auth/session.ts) navíc ověřuje účet a roli v databázi.
 */
export default withAuth({
  pages: { signIn: "/login" },
});

export const config = {
  // Veřejné jsou jen přihlášení, registrace, obnova hesla, endpointy
  // NextAuth a statické soubory Next.js. Všechno ostatní je chráněné.
  matcher: [
    "/((?!login|register|forgot-password|reset-password|api/auth|_next/static|_next/image|favicon\\.ico|robots\\.txt).*)",
  ],
};
