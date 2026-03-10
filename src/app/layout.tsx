import type { Metadata } from "next";
import { Geist, Geist_Mono, Shippori_Mincho } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import Link from "next/link";
import { GlobalHeader } from "@/components/global-header";
import { THEME_STORAGE_KEY } from "@/lib/theme/mode";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const shipporiMincho = Shippori_Mincho({
  variable: "--font-shippori-mincho",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "IDOL CROSSING - アイドルと音楽の情報交差点「アイドルクロッシング」",
  description: "アイドルと音楽の情報交差点「アイドルクロッシング」",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const key = "${THEME_STORAGE_KEY}";
                const saved = localStorage.getItem(key);
                const theme = saved === "light"
                  ? "pop"
                  : (saved === "pop" || saved === "dark"
                    ? saved
                    : "pop");
                document.documentElement.dataset.theme = theme;
              } catch {}
            `,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${shipporiMincho.variable} flex min-h-screen flex-col antialiased`}
      >
        <GlobalHeader />
        <div className="flex-1">{children}</div>
        <footer className="border-t border-[var(--ui-border)]">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
            <Link href="/" className="text-xs text-[var(--ui-text-subtle)] hover:text-[var(--ui-text)]">
              IDOL CROSSING -アイドルと音楽の情報交差点- powerd by musicite
            </Link>
            <div className="flex items-center gap-3">
              <a
                href="https://x.com/musicite_tw"
                target="_blank"
                rel="noreferrer"
                aria-label="X"
                className="text-[var(--ui-text-subtle)] hover:text-[var(--ui-text)]"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
                  <path d="M18.901 1.153h3.68l-8.039 9.19L24 22.847h-7.406l-5.8-7.584-6.636 7.584H.478l8.6-9.83L0 1.154h7.594l5.243 6.932 6.064-6.933Zm-1.29 19.494h2.04L6.486 3.24H4.298l13.313 17.407Z" />
                </svg>
              </a>
              <a
                href="https://www.youtube.com/@musicite8382"
                target="_blank"
                rel="noreferrer"
                aria-label="YouTube"
                className="text-[var(--ui-text-subtle)] hover:text-[var(--ui-text)]"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
                  <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31.3 31.3 0 0 0 0 12a31.3 31.3 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31.3 31.3 0 0 0 24 12a31.3 31.3 0 0 0-.5-5.8ZM9.6 15.6V8.4L15.8 12l-6.2 3.6Z" />
                </svg>
              </a>
            </div>
          </div>
        </footer>
        <Analytics />
      </body>
    </html>
  );
}
