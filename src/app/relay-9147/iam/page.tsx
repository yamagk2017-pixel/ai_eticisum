import Link from "next/link";

const links = [
  {
    href: "/relay-9147/iam/targets",
    title: "Targets",
    description: "今週の監視対象と理由を確認",
  },
  {
    href: "/relay-9147/iam/activities",
    title: "Activities",
    description: "収集・整形済みアクティビティを時系列で確認",
  },
  {
    href: "/relay-9147/iam/candidates",
    title: "Candidates",
    description: "週刊ニュース候補とスコアを確認",
  },
];

export default function IamConsoleIndexPage() {
  return (
    <div className="min-h-screen bg-[var(--ui-page)] text-[var(--ui-text)]">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-16">
        <header className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--ui-text-subtle)]">Relay 9147 / IAM</p>
          <h1 className="text-3xl font-semibold sm:text-4xl">IAM Console</h1>
          <p className="text-sm text-[var(--ui-text-muted)]">週次でアーカイブしたIAMデータの閲覧ページです。</p>
          <div className="flex gap-2">
            <Link href="/relay-9147" className="rounded-full border border-[var(--ui-border)] px-4 py-2 text-xs hover:border-zinc-500">
              /relay-9147
            </Link>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-2xl border border-[var(--ui-border)] bg-black/10 p-5 transition hover:border-zinc-500"
            >
              <h2 className="text-lg font-semibold">{link.title}</h2>
              <p className="mt-2 text-sm text-[var(--ui-text-muted)]">{link.description}</p>
              <p className="mt-4 text-xs text-[var(--ui-text-subtle)]">{link.href}</p>
            </Link>
          ))}
        </section>
      </main>
    </div>
  );
}

