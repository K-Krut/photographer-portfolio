"use client";

import { usePathname } from "next/navigation";
import { isLocale, locales, type Locale } from "@/lib/i18n";

function pathForLocale(pathname: string, locale: Locale): string {
  const segments = pathname.split("/");
  if (isLocale(segments[1] ?? "")) segments[1] = locale;
  else return `/${locale}`;
  return segments.join("/");
}

export function LanguageSwitcher({ locale }: { locale: Locale }) {
  const pathname = usePathname();

  return (
    <ul className="flex items-center gap-2">
      {locales.map((target, index) => (
        <li key={target} className="flex items-center gap-2">
          {index > 0 && <span aria-hidden="true">/</span>}
          <a
            href={pathForLocale(pathname, target)}
            hrefLang={target}
            lang={target}
            aria-current={target === locale ? "true" : undefined}
            className={
              target === locale
                ? "underline underline-offset-4"
                : "opacity-60 transition-opacity hover:opacity-100"
            }
          >
            {target.toUpperCase()}
          </a>
        </li>
      ))}
    </ul>
  );
}
