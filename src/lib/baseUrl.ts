import { headers } from "next/headers";

/**
 * Veřejná base URL appky pro odkazy v e-mailech apod. Přednost má
 * NEXT_PUBLIC_APP_URL, jinak se odvodí z Host hlavičky requestu — nikdy
 * přes `new URL()` na možná prázdný string (to už jednou shodilo build).
 */
export function getBaseUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (envUrl) return envUrl.replace(/\/+$/, "");

  const host = headers().get("host") ?? "";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
}
