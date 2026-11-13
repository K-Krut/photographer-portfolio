import type { Metadata } from "next";
import { jost } from "@/lib/font";
import { defaultLocale } from "@/lib/i18n";
import "./globals.css";

export const metadata: Metadata = {
  title: "404",
};

export default function GlobalNotFound() {
  return (
    <html lang={defaultLocale} suppressHydrationWarning className={`${jost.variable} antialiased`}>
      <body>
        <main className="flex min-h-screen items-center justify-center">
          <h1 className="text-sm uppercase tracking-[0.3em]">404</h1>
        </main>
      </body>
    </html>
  );
}
