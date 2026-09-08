export interface SendMailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Tenká vrstva pro odesílání e-mailů přes Resend REST API (žádná další
 * npm závislost, jen fetch). Vyžaduje env proměnnou RESEND_API_KEY —
 * bez ní se odeslání e-mailu neprovede a funkce vyhodí chybu, kterou
 * volající místo (viz src/app/forgot-password/actions.ts) odchytí.
 */
export async function sendMail(params: SendMailParams): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM || "Kontroly MS <onboarding@resend.dev>";

  if (!apiKey) {
    throw new Error("E-mailová služba není nakonfigurovaná (chybí RESEND_API_KEY).");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Odeslání e-mailu selhalo (${response.status}): ${errorBody}`);
  }
}
