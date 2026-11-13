import { site, texts } from "@/lib/content";
import type { Locale } from "@/lib/i18n";
import { bookingPath } from "@/lib/seo";
import { FixedHeader } from "./FixedHeader";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { HomeLink } from "./HomeLink";
import { MobileMenu } from "./MobileMenu";
import { type NavItem, NavLink } from "./NavLink";

const noScriptStyles = ".site-nav{display:flex}.site-menu-toggle{display:none}";

export function Header({ locale }: { locale: Locale }) {
  const { nav, menu } = texts[locale];
  const links: NavItem[] = [
    { id: "portfolio", href: `/${locale}#portfolio`, label: nav.portfolio },
    { id: "price", href: `/${locale}#price`, label: nav.price },
    { id: "contact", href: `/${locale}#contact`, label: nav.contact },
    { id: "booking", href: `/${locale}${bookingPath}`, label: nav.booking },
  ];

  return (
    <FixedHeader>
      <noscript>
        <style>{noScriptStyles}</style>
      </noscript>
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-8 gap-y-2 px-5 py-3 text-xs uppercase tracking-[0.25em] md:px-10 md:py-6">
        <HomeLink
          href={`/${locale}`}
          className="whitespace-nowrap text-sm transition-opacity hover:opacity-60"
        >
          {site.name}
        </HomeLink>
        <nav className="site-nav hidden flex-wrap items-center gap-x-5 gap-y-2 md:flex">
          <ul className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {links.map((link) => (
              <li key={link.id}>
                <NavLink href={link.href} className="transition-opacity hover:opacity-60">
                  {link.label}
                </NavLink>
              </li>
            ))}
          </ul>
          <LanguageSwitcher locale={locale} />
        </nav>
        <MobileMenu locale={locale} links={links} labels={menu} />
      </div>
    </FixedHeader>
  );
}
