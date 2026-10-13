import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { clearHits, ipFromHeaders, isRateLimited, MINUTE, recordHit } from "@/lib/auth/rateLimit";

// Omezení neúspěšných pokusů o přihlášení (proti zkoušení hesel hrubou silou).
const LOGIN_WINDOW_MS = 15 * MINUTE;
const LOGIN_MAX_FAILS_PER_EMAIL = 5;
const LOGIN_MAX_FAILS_PER_IP = 20;

// Přihlášení vyprší nejpozději po 12 hodinách (pracovní den), pak je potřeba
// se přihlásit znovu.
const SESSION_MAX_AGE_SECONDS = 12 * 60 * 60;

// Hash, se kterým se heslo porovná, i když účet neexistuje — odpověď pak
// trvá stejně dlouho a podle času nejde zjistit, které e-maily mají účet.
const DUMMY_PASSWORD_HASH = "$2a$10$I9iGnwyeVCh9GyfmJ9K5PuOvW7hWNS2F81uc6uKRnugfLhaTuLpx2";

export const RATE_LIMITED_LOGIN_ERROR = "Příliš mnoho neúspěšných pokusů. Zkus to prosím znovu za 15 minut.";

// E-mail a heslo. Role (USER/ADMIN) a platnost přihlášení se ověřují při
// každém požadavku v src/lib/auth/session.ts.
export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE_SECONDS },
  jwt: { maxAge: SESSION_MAX_AGE_SECONDS },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "E-mail a heslo",
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Heslo", type: "password" },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = credentials.email.toLowerCase().trim();
        const ip = ipFromHeaders((name) => {
          const value = req?.headers?.[name];
          return Array.isArray(value) ? value[0] : value;
        });
        const emailKey = `login:email:${email}`;
        const ipKey = `login:ip:${ip}`;

        if (
          (await isRateLimited(emailKey, LOGIN_MAX_FAILS_PER_EMAIL, LOGIN_WINDOW_MS)) ||
          (await isRateLimited(ipKey, LOGIN_MAX_FAILS_PER_IP, LOGIN_WINDOW_MS))
        ) {
          throw new Error(RATE_LIMITED_LOGIN_ERROR);
        }

        const user = await prisma.user.findUnique({ where: { email } });
        const isValid = await bcrypt.compare(credentials.password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);

        if (!user || !isValid) {
          await recordHit(emailKey);
          await recordHit(ipKey);
          return null;
        }

        await clearHits(emailKey);
        return { id: user.id, email: user.email, name: user.name ?? user.email, sessionVersion: user.sessionVersion };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.sv = user.sessionVersion ?? 0;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.sessionVersion = token.sv ?? 0;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
