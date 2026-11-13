"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Locale } from "@/lib/i18n";
import { lockScroll } from "@/lib/smooth-scroll";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { type NavItem, NavLink } from "./NavLink";

const menuId = "site-menu";
const desktop = "(min-width: 48rem)";

export function MobileMenu({
  locale,
  links,
  labels,
}: {
  locale: Locale;
  links: NavItem[];
  labels: { open: string; close: string };
}) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const release = useRef<(() => void) | null>(null);
  const pathname = usePathname();

  const close = useCallback((restoreFocus: boolean) => {
    release.current?.();
    release.current = null;
    setOpen(false);
    if (restoreFocus) button.current?.focus({ preventScroll: true });
  }, []);

  const [shownFor, setShownFor] = useState(pathname);
  if (shownFor !== pathname) {
    setShownFor(pathname);
    if (open) setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const unlock = lockScroll();
    release.current = unlock;
    panel.current?.querySelector<HTMLElement>("a[href]")?.focus({ preventScroll: true });

    const header = button.current?.closest("header");
    const media = window.matchMedia(desktop);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close(true);
        return;
      }
      if (event.key !== "Tab" || !button.current || !panel.current) return;
      const focusables = [
        button.current,
        ...panel.current.querySelectorAll<HTMLElement>("a[href], button"),
      ];
      const index = focusables.indexOf(document.activeElement as HTMLElement);
      const step = event.shiftKey ? -1 : 1;
      const next = index === -1 ? (event.shiftKey ? focusables.length - 1 : 0) : index + step;
      event.preventDefault();
      focusables[(next + focusables.length) % focusables.length].focus();
    };
    const onLinkClick = (event: MouseEvent) => {
      if (event.target instanceof Element && event.target.closest("a[href]")) close(false);
    };
    const onPopState = () => close(false);
    const onResize = () => {
      if (media.matches) close(false);
    };

    document.addEventListener("keydown", onKeyDown);
    header?.addEventListener("click", onLinkClick, true);
    window.addEventListener("popstate", onPopState);
    media.addEventListener("change", onResize);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      header?.removeEventListener("click", onLinkClick, true);
      window.removeEventListener("popstate", onPopState);
      media.removeEventListener("change", onResize);
      unlock();
      if (release.current === unlock) release.current = null;
    };
  }, [open, close]);

  return (
    <>
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={open ? labels.close : labels.open}
        onClick={() => (open ? close(true) : setOpen(true))}
        className="site-menu-toggle relative -mr-2.5 flex h-11 w-11 shrink-0 items-center justify-center md:hidden"
      >
        <span
          aria-hidden="true"
          className={`absolute h-[1.5px] w-6 bg-foreground transition-transform ${
            open ? "rotate-45" : "-translate-y-[3.5px]"
          }`}
        />
        <span
          aria-hidden="true"
          className={`absolute h-[1.5px] w-6 bg-foreground transition-transform ${
            open ? "-rotate-45" : "translate-y-[3.5px]"
          }`}
        />
      </button>
      <div
        ref={panel}
        id={menuId}
        className={`absolute inset-x-0 top-full h-[calc(100dvh-100%)] overflow-y-auto overscroll-contain bg-background md:hidden ${
          open
            ? "visible opacity-100 transition-opacity"
            : "pointer-events-none invisible opacity-0 transition-[opacity,visibility]"
        }`}
      >
        <nav className="px-5 pt-10 pb-12">
          <ul className="flex flex-col gap-7">
            {links.map((link, index) => (
              <li
                key={link.id}
                className={`transition-[opacity,translate] duration-[calc(var(--motion-duration)*1.6)] ${
                  open ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
                }`}
                style={{
                  transitionDelay: open
                    ? `calc(var(--motion-duration) * ${0.2 + index * 0.15})`
                    : "0s",
                }}
              >
                <NavLink
                  href={link.href}
                  className="text-2xl tracking-[0.25em] transition-opacity hover:opacity-60"
                >
                  {link.label}
                </NavLink>
              </li>
            ))}
          </ul>
          <div
            className={`mt-14 text-sm tracking-[0.25em] transition-[opacity,translate] duration-[calc(var(--motion-duration)*1.6)] ${
              open ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
            }`}
            style={{
              transitionDelay: open
                ? `calc(var(--motion-duration) * ${0.2 + links.length * 0.15})`
                : "0s",
            }}
          >
            <LanguageSwitcher locale={locale} />
          </div>
        </nav>
      </div>
    </>
  );
}
