import Link from "next/link";
import { verifyRegistrationCode, resendRegistrationCode } from "../actions";

export default function VerifyRegistrationPage({
  searchParams,
}: {
  searchParams: { email?: string; error?: string; sent?: string };
}) {
  const email = searchParams.email ?? "";

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-soft">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-semibold text-slate-900">Ověření e-mailu</h1>
          <p className="mt-1 text-sm text-slate-500">Kontroly MS — NMS Market Research</p>
        </div>

        {!email ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            Chybí e-mail k ověření. Vrať se prosím na{" "}
            <Link href="/register" className="font-medium underline">
              registraci
            </Link>
            .
          </p>
        ) : (
          <>
            <p className="mb-4 text-sm text-slate-500">
              Na <strong>{email}</strong> jsme poslali šestimístný ověřovací kód. Opiš ho sem, ať dokončíš
              registraci.
            </p>

            {searchParams.sent && (
              <p className="mb-4 rounded-lg bg-brand-green-50 px-3 py-2 text-sm text-brand-green-700">
                Nový kód byl odeslán.
              </p>
            )}
            {searchParams.error && (
              <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{searchParams.error}</p>
            )}

            <form action={verifyRegistrationCode} className="space-y-4">
              <input type="hidden" name="email" value={email} />
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="code">
                  Ověřovací kód
                </label>
                <input
                  id="code"
                  name="code"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  autoComplete="one-time-code"
                  required
                  placeholder="123456"
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-center text-lg font-semibold tracking-[0.3em] focus:border-brand-blue-400 focus:outline-none focus:ring-2 focus:ring-brand-blue-100"
                />
              </div>
              <button
                type="submit"
                className="w-full rounded-xl bg-brand-blue-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-blue-600"
              >
                Ověřit a dokončit registraci
              </button>
            </form>

            <form action={resendRegistrationCode} className="mt-3">
              <input type="hidden" name="email" value={email} />
              <button type="submit" className="w-full text-center text-sm font-medium text-brand-blue-600">
                Nedorazil kód? Poslat znovu
              </button>
            </form>
          </>
        )}

        <p className="mt-6 text-center text-sm text-slate-500">
          <Link href="/register" className="font-medium text-brand-blue-600">
            ← Upravit e-mail / registraci
          </Link>
        </p>
      </div>
    </div>
  );
}
