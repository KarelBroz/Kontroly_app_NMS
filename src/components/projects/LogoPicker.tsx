"use client";

import { useEffect, useState } from "react";
import { ImagePlus } from "lucide-react";
import { MAX_LOGO_BYTES } from "@/lib/logo";

/**
 * Výběr loga projektu s okamžitým náhledem: hned po výběru souboru se
 * v okénku ukáže obrázek, název a velikost, takže je jasné, že se logo
 * opravdu nahraje. Příliš velký nebo jiný než obrázkový soubor se rovnou
 * odmítne (server by ho stejně nepřijal).
 */
export function LogoPicker({ id, currentLogoUrl }: { id: string; currentLogoUrl?: string | null }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [fileInfo, setFileInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setError(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setFileInfo(null);
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Tohle není obrázek — vyber prosím PNG, JPG, SVG apod.");
      e.target.value = "";
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setError(`Soubor má ${(file.size / 1024 / 1024).toFixed(1)} MB, logo může mít nejvýš ${MAX_LOGO_BYTES / 1024 / 1024} MB.`);
      e.target.value = "";
      return;
    }
    setPreview(URL.createObjectURL(file));
    setFileInfo(`${file.name} · ${Math.max(1, Math.round(file.size / 1024))} kB`);
  }

  const shown = preview ?? currentLogoUrl ?? null;

  return (
    <div>
      <label
        htmlFor={id}
        className="mt-1 flex cursor-pointer items-center gap-4 rounded-xl border border-dashed border-slate-300 p-4 hover:border-brand-blue-400 hover:bg-brand-blue-50/40"
      >
        {shown ? (
          // data:/blob: URL — plain <img>, next/image na ně nemá smysl
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={shown}
            alt="Náhled loga"
            className="h-16 w-16 shrink-0 rounded-lg border border-slate-200 bg-white object-contain"
          />
        ) : (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
            <ImagePlus className="h-5 w-5" />
          </div>
        )}
        <span className="text-sm text-slate-600">
          {preview ? (
            <>
              <span className="font-medium text-brand-green-700">Logo vybráno</span> — uloží se po odeslání formuláře.
              <span className="block text-xs text-slate-500">{fileInfo} · kliknutím vybereš jiné</span>
            </>
          ) : currentLogoUrl ? (
            "Logo úspěšně nahráno, kliknutím můžete logo změnit"
          ) : (
            "Nahrát logo"
          )}
        </span>
        <input id={id} name="logo" type="file" accept="image/*" className="hidden" onChange={handleChange} />
      </label>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
