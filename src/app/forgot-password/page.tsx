import Link from "next/link";
import { requestPasswordReset } from "./actions";

export default function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: { error?: string; sent?: string };
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-soft">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-semibold text-slate-900">Zapomenuté heslo</h1>
          <p className="mt-1 text-sm text-slate-500">Kontroly MS — NMS Market Research</p>
        </div>

        {searchParams.sent ? (
          <p className="rounded-lg bg-brand-green-50 px-3 py-2 text-sm text-brand-green-700">
            Pokud pod touhle adresou účet existuje, poslali jsme na ni odkaz pro nastavení nového hesla.
            Zkontroluj si e-mail (i spam).
          </p>
        ) : (
          <>
            {searchParams.error && (
              <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{searchParams.error}</p>
            )}
            <p className="mb-4 text-sm text-slate-500">
              Zadej svůj e-mail a pošleme ti odkaz pro nastavení nového hesla.
            </p>
            <form action={requestPasswordReset} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="email">
                  E-mail
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-brand-blue-400 focus:outline-none focus:ring-2 focus:ring-brand-blue-100"
                />
              </div>
              <button
                type="submit"
                className="w-full rounded-xl bg-brand-blue-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-blue-600"
              >
                Poslat odkaz pro obnovení hesla
              </button>
            </form>
          </>
        )}

        <p className="mt-6 text-center text-sm text-slate-500">
          <Link href="/login" className="font-medium text-brand-blue-600">
            ← Zpátky na přihlášení
          </Link>
        </p>
      </div>
    </div>
  );
}
