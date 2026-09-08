import type { Metadata } from "next";
import "./globals.css";
import { AuthSessionProvider } from "@/components/providers/AuthSessionProvider";

export const metadata: Metadata = {
  title: "Kontroly MS",
  description: "Kontrola dat z projektů mystery shoppingu — NMS Market Research",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="cs">
      <body>
        <AuthSessionProvider>{children}</AuthSessionProvider>
      </body>
    </html>
  );
}
