"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  href: string;
  label: string;
  match?: (pathname: string) => boolean;
};

const navItems: NavItem[] = [
  { href: "/", label: "Home", match: (pathname) => pathname === "/" },
  {
    href: "/imakite",
    label: "IMAKITE",
    match: (pathname) => pathname.startsWith("/imakite") && !pathname.startsWith("/imakite/weekly"),
  },
  {
    href: "/imakite/weekly",
    label: "IMAKITE Weekly",
    match: (pathname) => pathname.startsWith("/imakite/weekly"),
  },
  { href: "/nandatte", label: "NANDATTE", match: (pathname) => pathname.startsWith("/nandatte") },
  { href: "/buzzttara", label: "BUZZTTARA", match: (pathname) => pathname.startsWith("/buzzttara") },
];

export function GlobalHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--ui-border)] bg-[color-mix(in_oklab,var(--ui-panel)_88%,transparent)] backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="shrink-0 text-sm font-semibold tracking-[0.18em]">
          TEKITO
        </Link>

        <nav className="min-w-0 flex-1 overflow-x-auto">
          <ul className="flex min-w-max items-center gap-2">
            {navItems.map((item) => {
              const active = item.match ? item.match(pathname) : pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`inline-flex rounded-full px-3 py-1.5 text-xs transition ${
                      active
                        ? "bg-[var(--ui-text)] text-[var(--ui-page)]"
                        : "text-[var(--ui-text-muted)] hover:bg-[var(--ui-panel-soft)]"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </header>
  );
}
