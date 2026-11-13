"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";
import { AnchorLink } from "./AnchorLink";

export type NavItem = { id: string; href: string; label: string };

export function NavLink({
  href,
  ...props
}: Omit<ComponentProps<typeof Link>, "href"> & { href: string }) {
  const pathname = usePathname();
  if (href.includes("#")) return <AnchorLink href={href} {...props} />;
  return <Link href={href} aria-current={pathname === href ? "page" : undefined} {...props} />;
}
