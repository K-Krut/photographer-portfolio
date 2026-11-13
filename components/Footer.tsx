import { cacheLife } from "next/cache";
import { site, texts } from "@/lib/content";
import type { Locale } from "@/lib/i18n";
import { phoneLink } from "@/lib/phone";

const contactLink =
  "inline-block text-lg underline decoration-transparent underline-offset-4 transition-[text-decoration-color] hover:decoration-current";

async function buildYear() {
  "use cache";
  cacheLife("max");
  return new Date().getFullYear();
}

export async function Footer({ locale }: { locale: Locale }) {
  const { headings } = texts[locale];
  const year = await buildYear();
  const phone = phoneLink(site.phone);

  return (
    <footer
      id="contact"
      aria-labelledby="contact-heading"
      className="mx-auto max-w-6xl px-5 py-16 md:px-10 md:py-24"
    >
      <h2
        id="contact-heading"
        className="text-xl uppercase tracking-[0.3em] md:text-2xl"
      >
        {headings.contact}
      </h2>
      <div className="mt-10 flex flex-col items-start gap-3 md:flex-row md:items-baseline md:gap-x-10">
        <a href={`mailto:${site.email}`} className={contactLink}>
          {site.email}
        </a>
        {phone && (
          <a href={phone.href} className={contactLink}>
            {phone.label}
          </a>
        )}
      </div>
      <ul className="mt-6 flex flex-wrap gap-x-8 gap-y-3 text-sm uppercase tracking-[0.25em]">
        {site.socials.map((social) => (
          <li key={social.href}>
            <a
              href={social.href}
              target="_blank"
              rel="noopener noreferrer"
              className="transition-opacity hover:opacity-60"
            >
              {social.label}
            </a>
          </li>
        ))}
      </ul>
      <p className="mt-16 text-xs text-muted">
        © {year} {site.name}
      </p>
    </footer>
  );
}
