import Link from "next/link";
import { getNewsList } from "@/lib/news";
import { hasWpApiBaseUrlConfigured, WpClientError } from "@/lib/wp/client";
import { hasSanityStudioEnv } from "@/sanity/env";

export const dynamic = "force-dynamic";

type SearchParams =
  | Record<string, string | string[] | undefined>
  | Promise<Record<string, string | string[] | undefined>>;

function firstParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return typeof value === "string" && value.trim() ? value : null;
}

function formatDate(value: string | null) {
  if (!value) return "-";
  const time = Date.parse(value);
  if (Number.isNaN(time)) return value;
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(time));
}

export default async function NewsIndexPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const categoryParam = firstParam(resolvedSearchParams.category);
  const tagParam = firstParam(resolvedSearchParams.tag);
  const categorySlug = categoryParam?.trim() || undefined;
  const tagSlug = tagParam?.trim() || undefined;
  const hasWpBaseUrl = hasWpApiBaseUrlConfigured();
  const hasSanity = hasSanityStudioEnv();
  const hasAnyNewsSource = hasWpBaseUrl || hasSanity;

  let articles = [] as Awaited<ReturnType<typeof getNewsList>>;
  let fetchError: string | null = null;

  if (hasAnyNewsSource) {
    try {
      articles = await getNewsList({limit: 10, categorySlug, tagSlug});
    } catch (error) {
      if (error instanceof WpClientError) {
        fetchError =
          error.kind === "timeout"
            ? "WordPress APIの応答がタイムアウトしました。時間をおいて再試行してください。"
            : "WordPress APIから記事を取得できませんでした。";
      } else {
        fetchError = "記事取得中に予期しないエラーが発生しました。";
      }
    }
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-12 sm:px-12">
      <div className="mb-8">
        <h1 className="font-mincho-jp text-3xl font-semibold tracking-tight sm:text-4xl">News</h1>
        <p className="mt-3 text-sm text-[var(--ui-text-subtle)]">
          WordPress記事とSanity新規記事の一覧（段階統合）。最新10件を表示しています。
        </p>
      </div>

      {!hasAnyNewsSource ? (
        <div className="rounded-xl border border-[var(--ui-border)] bg-[var(--ui-panel)] p-5 text-sm text-[var(--ui-text-subtle)]">
          `WP_API_BASE_URL` と Sanity環境変数が未設定です。記事一覧を取得できません。
        </div>
      ) : fetchError ? (
        <div className="rounded-xl border border-rose-300/70 bg-rose-50 p-5 text-sm text-rose-900 dark:border-rose-800/60 dark:bg-rose-950/30 dark:text-rose-200">
          {fetchError}
        </div>
      ) : articles.length === 0 ? (
        <div className="rounded-xl border border-[var(--ui-border)] bg-[var(--ui-panel)] p-5 text-sm text-[var(--ui-text-subtle)]">
          記事が取得できませんでした。
        </div>
      ) : (
        <div className="grid gap-4">
          {articles.map((article) => (
            <article
              key={article.path}
              className="grid gap-4 rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-panel)] p-4 sm:grid-cols-[180px_minmax(0,1fr)]"
            >
              <Link href={article.path} className="block">
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
                  <span>{formatDate(article.publishedAt)}</span>
                  {article.categories.slice(0, 2).map((category) =>
                    category.slug ? (
                      <Link
                        key={category.id}
                        href={`/news?category=${category.slug}`}
                        className="underline underline-offset-2"
                      >
                        {category.name}
                      </Link>
                    ) : (
                      <span key={category.id}>{category.name}</span>
                    )
                  )}
                </div>

                <Link href={article.path} className="block">
                  <h2
                    className="font-mincho-jp text-xl font-semibold leading-snug text-[var(--ui-text)] underline decoration-zinc-400 underline-offset-4 dark:decoration-zinc-500"
                    dangerouslySetInnerHTML={{ __html: article.titleHtml }}
                  />
                </Link>

                {article.tags.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {article.tags.slice(0, 4).map((tag) =>
                      tag.slug ? (
                        <Link
                          key={tag.id}
                          href={`/news?tag=${tag.slug}`}
                          className="rounded-full border border-[var(--ui-border)] bg-[var(--ui-panel-soft)] px-2 py-1 text-xs text-[var(--ui-text)]"
                        >
                          {tag.name}
                        </Link>
                      ) : (
                        <span
                          key={tag.id}
                          className="rounded-full border border-[var(--ui-border)] bg-[var(--ui-panel-soft)] px-2 py-1 text-xs text-[var(--ui-text)]"
                        >
                          {tag.name}
                        </span>
                      )
                    )}
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
