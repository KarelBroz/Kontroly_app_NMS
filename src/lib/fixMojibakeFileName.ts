/**
 * Prohlizec posle jmeno nahravaneho souboru v multipart hlavicce jako UTF-8
 * bajty, ale runtime (Node/undici) ho v `File.name` obcas vrati prectene
 * jako Latin-1 (bajt = znak 1:1) - diakritika se pak rozsype.
 *
 * Bezztratove napravitelne: vezmeme znaky zpatky jako bajty (0-255) a
 * rozkodujeme je znovu jako UTF-8. Pokud vysledek neni platne UTF-8 (nebo
 * nazev zadne "vysoke" bajty vubec neobsahuje), byl nazev v poradku uz
 * predtim - nechame ho beze zmeny, at se nic nerozbije.
 */
const HAS_HIGH_BYTE_CHAR = new RegExp("[\\u0080-\\u00ff]");
const REPLACEMENT_CHAR = String.fromCharCode(0xfffd);

export function fixMojibakeFileName(name: string): string {
  if (!HAS_HIGH_BYTE_CHAR.test(name)) return name;
  const repaired = Buffer.from(name, "latin1").toString("utf8");
  return repaired.includes(REPLACEMENT_CHAR) ? name : repaired;
}
