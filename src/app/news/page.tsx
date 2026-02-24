import Link from "next/link";
import { getWpNewsList } from "@/lib/news/wp";

export const dynamic = "force-dynamic";

function formatDate(value: string | null) {
  if (!value) return "-";
  const time = Date.parse(value);
  if (Number.isNaN(time)) return value;
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(time));
}

export default async function NewsIndexPage() {
  const articles = await getWpNewsList(10);

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-12 sm:px-12">
      <div className="mb-8">
        <h1 className="font-mincho-jp text-3xl font-semibold tracking-tight sm:text-4xl">News</h1>
        <p className="mt-3 text-sm text-[var(--ui-text-subtle)]">
          WordPress記事の本番ルート（フェーズ1）。最新10件を表示しています。
        </p>
      </div>

      {articles.length === 0 ? (
        <div className="rounded-xl border border-[var(--ui-border)] bg-[var(--ui-panel)] p-5 text-sm text-[var(--ui-text-subtle)]">
          記事が取得できませんでした。
        </div>
      ) : (
        <div className="grid gap-4">
          {articles.map((article) => (
            <article
              key={article.id}
              className="grid gap-4 rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-panel)] p-4 sm:grid-cols-[180px_minmax(0,1fr)]"
            >
              <Link href={`/news/wp/${article.id}`} className="block">
                {article.featuredImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={article.featuredImageUrl}
                    alt={article.featuredImageAlt ?? ""}
                    className="h-28 w-full rounded-lg object-cover sm:h-full"
                  />
                ) : (
                  <div className="flex h-28 items-center justify-center rounded-lg bg-[var(--ui-panel-soft)] text-xs text-[var(--ui-text-subtle)] sm:h-full">
                    No Image
                  </div>
                )}
              </Link>

              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--ui-text-subtle)]">
                  <span>{formatDate(article.date)}</span>
                  {article.categories.slice(0, 2).map((category) => (
                    <span key={category.id}>{category.name}</span>
                  ))}
                </div>

                <Link href={`/news/wp/${article.id}`} className="block">
                  <h2
                    className="font-mincho-jp text-xl font-semibold leading-snug text-[var(--ui-text)]"
                    dangerouslySetInnerHTML={{ __html: article.titleHtml }}
                  />
                </Link>

                {article.tags.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {article.tags.slice(0, 4).map((tag) => (
                      <span
                        key={tag.id}
                        className="rounded-full border border-[var(--ui-border)] bg-[var(--ui-panel-soft)] px-2 py-1 text-xs text-[var(--ui-text)]"
                      >
                        {tag.name}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}

