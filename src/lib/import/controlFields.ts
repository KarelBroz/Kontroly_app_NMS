/**
 * Sloupce "Control: Firstname", "Control: Surname", "Control: Email" v
 * importu — identita externího kontrolora, co danou návštěvu ručně prošel
 * před importem do appky (viz model Reviewer). Hledá se tolerantně
 * (case-insensitive, bez ohledu na přesné mezery kolem dvojtečky), ať
 * drobná odchylka v hlavičce importu nic nerozbije.
 */
function findControlValue(data: Record<string, unknown>, key: "firstname" | "surname" | "email"): string | null {
  for (const [header, value] of Object.entries(data)) {
    const h = header.toLowerCase();
    if (h.includes("control") && h.includes(key)) {
      const v = String(value ?? "").trim();
      return v || null;
    }
  }
  return null;
}

export interface ControlReviewer {
  firstName: string;
  lastName: string;
  email: string;
}

/** Vrátí kontrolora z Control: sloupců řádku, nebo null (chybí e-mail — bez e-mailu nejde profil spárovat/založit). */
export function readControlReviewer(data: Record<string, unknown>): ControlReviewer | null {
  const email = findControlValue(data, "email");
  if (!email) return null;
  return {
    email: email.toLowerCase(),
    firstName: findControlValue(data, "firstname") ?? "",
    lastName: findControlValue(data, "surname") ?? "",
  };
}
