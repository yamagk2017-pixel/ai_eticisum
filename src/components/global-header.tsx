"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type NavItem = {
  href: string;
  label: string;
  match?: (pathname: string) => boolean;
};

const navItems: NavItem[] = [
  { href: "/", label: "ホーム", match: (pathname) => pathname === "/" },
  { href: "/news", label: "アイドルニュース", match: (pathname) => pathname.startsWith("/news") },
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
  const router = useRouter();
  const [userLabel, setUserLabel] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const menuRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    const current = document.documentElement.dataset.theme;
    if (current === "light" || current === "dark") {
      setTheme(current);
      return;
    }
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setTheme(prefersDark ? "dark" : "light");
  }, []);

  useEffect(() => {
    if (!menuOpen && !searchOpen) return;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      const inMenu = menuRef.current?.contains(target) ?? false;
      const inSearch = searchRef.current?.contains(target) ?? false;
      if (inMenu || inSearch) return;
      setMenuOpen(false);
      setSearchOpen(false);
    };

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        setSearchOpen(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onEscape);
    };
  }, [menuOpen, searchOpen]);

  useEffect(() => {
    setMobileNavOpen(false);
    setMenuOpen(false);
    setSearchOpen(false);
  }, [pathname]);

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const q = searchText.trim();
    if (!q) return;
    router.push(`/search?q=${encodeURIComponent(q)}`);
    setSearchOpen(false);
  };

  const applyTheme = (nextTheme: "light" | "dark") => {
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem("musicite-theme", nextTheme);
  };

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
      setMenuOpen(false);
    } finally {
      setAuthBusy(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--ui-border)] bg-[color-mix(in_oklab,var(--ui-panel)_88%,transparent)] backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-3 sm:gap-4 sm:px-6">
        <Link href="/" className="shrink-0 text-sm font-semibold tracking-[0.18em]">
          IDOL CROSSING
        </Link>

        <nav className="hidden min-w-0 flex-1 overflow-x-auto md:block">
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

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <div ref={menuRef} className="relative flex shrink-0 items-center gap-2">
            {userLabel ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen((open) => !open);
                    setSearchOpen(false);
                  }}
                  disabled={authBusy}
                  className="inline-flex items-center gap-1 rounded-full bg-[var(--ui-text)] px-3 py-1.5 text-xs text-[var(--ui-page)] hover:opacity-90 disabled:opacity-60"
                  aria-expanded={menuOpen}
                  aria-haspopup="menu"
                >
                  {userLabel}
                  <span aria-hidden="true" className="text-[10px]">
                    {menuOpen ? "▲" : "▼"}
                  </span>
                </button>

                {menuOpen && (
                  <div className="absolute right-0 top-full z-50 mt-2 w-52 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-panel)] p-2 shadow-lg">
                    <div className="flex flex-col">
                      <button
                        type="button"
                        onClick={handleSignOut}
                        disabled={authBusy}
                        className="rounded-lg px-3 py-2 text-left text-xs text-[var(--ui-text)] hover:bg-[var(--ui-panel-soft)] disabled:opacity-60"
                      >
                        ログアウト
                      </button>
                      <Link
                        href="/nandatte/me"
                        onClick={() => setMenuOpen(false)}
                        className="rounded-lg px-3 py-2 text-xs text-[var(--ui-text)] hover:bg-[var(--ui-panel-soft)]"
                      >
                        マイ投票
                      </Link>
                      <div className="mt-1 rounded-lg px-3 py-2">
                        <p className="text-[10px] text-[var(--ui-text-subtle)]">デザイン切り替え</p>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => applyTheme("dark")}
                            className={`rounded-md px-2 py-1 text-xs ${
                              theme === "dark"
                                ? "bg-[var(--ui-text)] text-[var(--ui-page)]"
                                : "bg-[var(--ui-panel-soft)] text-[var(--ui-text-muted)]"
                            }`}
                          >
                            ダーク
                          </button>
                          <button
                            type="button"
                            onClick={() => applyTheme("light")}
                            className={`rounded-md px-2 py-1 text-xs ${
                              theme === "light"
                                ? "bg-[var(--ui-text)] text-[var(--ui-page)]"
                                : "bg-[var(--ui-panel-soft)] text-[var(--ui-text-muted)]"
                            }`}
                          >
                            ライト
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
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

          <div ref={searchRef} className="relative">
            <button
              type="button"
              onClick={() => {
                setSearchOpen((open) => !open);
                setMenuOpen(false);
              }}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--ui-border)] text-[var(--ui-text)]"
              aria-expanded={searchOpen}
              aria-haspopup="dialog"
              aria-label="検索を開く"
            >
              <span aria-hidden="true" className="text-sm leading-none">🔍</span>
            </button>

            {searchOpen && (
              <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-panel)] p-3 shadow-lg">
                <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
                  <input
                    type="search"
                    value={searchText}
                    onChange={(event) => setSearchText(event.target.value)}
                    placeholder="キーワードを入力"
                    className="h-9 w-full rounded-md border border-[var(--ui-border)] bg-[var(--ui-page)] px-3 text-sm text-[var(--ui-text)] outline-none focus:border-[var(--ui-text-subtle)]"
                  />
                  <button
                    type="submit"
                    className="shrink-0 rounded-md bg-[var(--ui-text)] px-3 py-2 text-xs text-[var(--ui-page)]"
                  >
                    検索
                  </button>
                </form>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setMobileNavOpen((open) => !open)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--ui-border)] text-[var(--ui-text)] md:hidden"
            aria-expanded={mobileNavOpen}
            aria-controls="global-mobile-nav"
            aria-label="ナビゲーションを開く"
          >
            <span aria-hidden="true" className="text-base leading-none">
              {mobileNavOpen ? "×" : "☰"}
            </span>
          </button>
        </div>
      </div>

      {mobileNavOpen && (
        <nav id="global-mobile-nav" className="border-t border-[var(--ui-border)] px-4 pb-3 md:hidden sm:px-6">
          <ul className="flex flex-col gap-1 pt-3">
            {navItems.map((item) => {
              const active = item.match ? item.match(pathname) : pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setMobileNavOpen(false)}
                    className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm font-semibold transition ${
                      active
                        ? "bg-[var(--ui-panel-soft)] text-[var(--ui-text)]"
                        : "text-[var(--ui-text-muted)] hover:bg-[var(--ui-panel-soft)]"
                    }`}
                  >
                    <span>{item.label}</span>
                    {active && <span aria-hidden="true">✓</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </header>
  );
}
