import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Locale } from "../lib/i18n";
import {
  photographerCancellationEmail,
  photographerReservationEmail,
  visitorCancellationEmail,
  visitorReservationEmail,
  type MessageSite,
} from "../lib/booking/messages.ts";
import type { EmailMessage, Reservation } from "../lib/booking/provider";

const outDir = resolve(process.argv[2] ?? ".email-previews");

const site: MessageSite = {
  name: "Viktor Rowan",
  email: "hello@example.com",
  phone: "+48 000 000 000",
  url: "https://rowan.example",
};

const sessionTypes: Record<Locale, string> = { en: "Portraits", pl: "Portrety" };

function sample(locale: Locale): Reservation {
  return {
    id: "preview-1",
    createdAt: new Date("2026-10-12T08:00:00Z"),
    start: new Date("2026-10-15T10:00:00Z"),
    end: new Date("2026-10-15T12:00:00Z"),
    duration: 2,
    price: 700,
    locale,
    name: "Ada <Lovelace> & Co",
    email: "ada@example.com",
    phone: "+48 123 456 789",
    telegram: "@ada_l",
    sessionType: "portraits",
    comment: "Outdoor, please.\nNear the river — <b>not</b> in the studio.",
  };
}

mkdirSync(outDir, { recursive: true });

for (const locale of ["en", "pl"] as const) {
  const reservation = sample(locale);
  const context = { site, currency: "PLN", sessionTypeName: sessionTypes[locale] };
  const cancelUrl = (kind: string) => `${site.url}/${locale}/booking/cancel?token=${kind}-preview-token`;
  const emails: [string, EmailMessage][] = [
    ["visitor-reservation", visitorReservationEmail(reservation, { ...context, cancelUrl: cancelUrl("visitor") })],
    [
      "photographer-reservation",
      photographerReservationEmail(reservation, { ...context, cancelUrl: cancelUrl("photographer") }, "viktor@example.com"),
    ],
    ["visitor-cancelled-by-visitor", visitorCancellationEmail(reservation, "visitor", context)],
    ["visitor-cancelled-by-photographer", visitorCancellationEmail(reservation, "photographer", context)],
    ["photographer-cancelled-by-visitor", photographerCancellationEmail(reservation, "visitor", context, "viktor@example.com")],
    [
      "photographer-cancelled-by-photographer",
      photographerCancellationEmail(reservation, "photographer", context, "viktor@example.com"),
    ],
  ];
  for (const [name, email] of emails) {
    const file = join(outDir, `${locale}-${name}.html`);
    writeFileSync(file, email.html ?? "");
    console.log(file);
  }
}
