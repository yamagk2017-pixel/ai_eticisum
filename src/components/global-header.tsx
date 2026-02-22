"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type NavItem = {
  href: string;
  label: string;
  match?: (pathname: string) => boolean;
};

const navItems: NavItem[] = [
  { href: "/", label: "ホーム", match: (pathname) => pathname === "/" },
  {
    href: "/imakite",
    label: "イマキテランキング",
    match: (pathname) => pathname.startsWith("/imakite") && !pathname.startsWith("/imakite/weekly"),
  },
  {
    href: "/imakite/weekly",
    label: "イマキテWEEKLY",
    match: (pathname) => pathname.startsWith("/imakite/weekly"),
  },
  { href: "/nandatte", label: "ナンダッテ", match: (pathname) => pathname.startsWith("/nandatte") },
  { href: "/buzzttara", label: "バズッタラ", match: (pathname) => pathname.startsWith("/buzzttara") },
];

export function GlobalHeader() {
  const pathname = usePathname();
  const [userLabel, setUserLabel] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    const syncUser = async () => {
      const { data } = await supabase.auth.getUser();
      const email = data.user?.email ?? null;
      setUserLabel(email ? email.split("@")[0] ?? email : null);
    };

    syncUser().catch(() => null);

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const email = session?.user?.email ?? null;
      setUserLabel(email ? email.split("@")[0] ?? email : null);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  const handleGoogleSignIn = async () => {
    setAuthBusy(true);
    try {
      const supabase = createClient();
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.href },
      });
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSignOut = async () => {
    setAuthBusy(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } finally {
      setAuthBusy(false);
    }
  };

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
                    className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      active
                        ? "text-[var(--ui-text)]"
                        : "text-[var(--ui-text-muted)] hover:bg-[var(--ui-panel-soft)]"
                    }`}
                  >
                    {active && <span aria-hidden="true">✓</span>}
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          {userLabel ? (
            <button
              type="button"
              onClick={handleSignOut}
              disabled={authBusy}
              className="inline-flex rounded-full bg-[var(--ui-text)] px-3 py-1.5 text-xs text-[var(--ui-page)] hover:opacity-90 disabled:opacity-60"
              title="クリックでログアウト"
            >
              {userLabel}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={authBusy}
              className="inline-flex rounded-full bg-white px-3 py-1.5 text-xs text-black hover:bg-zinc-100 disabled:opacity-60"
            >
              Googleログイン
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
