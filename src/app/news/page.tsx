import Link from "next/link";
import type {Metadata} from "next";
import { getNewsPage } from "@/lib/news";
import { hasWpApiBaseUrlConfigured, WpClientError } from "@/lib/wp/client";
import { hasSanityStudioEnv } from "@/sanity/env";

export const dynamic = "force-dynamic";
const NEWS_LIST_TITLE_SUFFIX = " | IDOL CROSSING - アイドルと音楽の情報交差点「アイドルクロッシング」";

type SearchParams =
  | Record<string, string | string[] | undefined>
  | Promise<Record<string, string | string[] | undefined>>;

function firstParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return typeof value === "string" && value.trim() ? value : null;
}

function parsePageParam(value: string | null): number {
  if (!value) return 1;
  const num = Number(value);
  if (!Number.isFinite(num)) return 1;
  return Math.max(1, Math.trunc(num));
}

function slugToLabel(slug: string): string {
  return slug.replace(/[-_]+/g, " ").trim() || slug;
}

function buildNewsHref(params: { page?: number; category?: string; tag?: string }) {
  const search = new URLSearchParams();
  if (params.page && params.page > 1) search.set("page", String(params.page));
  if (params.category) search.set("category", params.category);
  if (params.tag) search.set("tag", params.tag);
  const query = search.toString();
  return query ? `/news?${query}` : "/news";
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

function PaginationNav({
  page,
  totalPages,
  categorySlug,
  tagSlug,
  align = "center",
}: {
  page: number;
  totalPages: number;
  categorySlug?: string;
  tagSlug?: string;
  align?: "center" | "right";
}) {
  const justifyClass = align === "right" ? "justify-end" : "justify-center";

  return (
    <nav
      aria-label={align === "right" ? "Pagination Top" : "Pagination Bottom"}
      className={`flex flex-wrap items-center ${justifyClass} gap-2 text-sm`}
    >
      {page > 1 ? (
        <Link
          href={buildNewsHref({ page: page - 1, category: categorySlug, tag: tagSlug })}
          className="rounded-lg border border-[var(--ui-border)] px-3 py-2 text-[var(--ui-text)]"
        >
          前へ
        </Link>
      ) : (
        <span className="rounded-lg border border-[var(--ui-border)] px-3 py-2 text-[var(--ui-text-subtle)]">
          前へ
        </span>
      )}

      <span className="px-2 text-[var(--ui-text-subtle)]">
        {page} / {totalPages}
      </span>

      {page < totalPages ? (
        <Link
          href={buildNewsHref({ page: page + 1, category: categorySlug, tag: tagSlug })}
          className="rounded-lg border border-[var(--ui-border)] px-3 py-2 text-[var(--ui-text)]"
        >
          次へ
        </Link>
      ) : (
        <span className="rounded-lg border border-[var(--ui-border)] px-3 py-2 text-[var(--ui-text-subtle)]">
          次へ
        </span>
      )}
    </nav>
  );
}

export default async function NewsIndexPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const categoryParam = firstParam(resolvedSearchParams.category);
  const tagParam = firstParam(resolvedSearchParams.tag);
  const pageParam = firstParam(resolvedSearchParams.page);
  const categorySlug = categoryParam?.trim() || undefined;
  const tagSlug = tagParam?.trim() || undefined;
  const currentPage = parsePageParam(pageParam);
  const hasWpBaseUrl = hasWpApiBaseUrlConfigured();
  const hasSanity = hasSanityStudioEnv();
  const hasAnyNewsSource = hasWpBaseUrl || hasSanity;

  let pageResult = { items: [], total: 0, page: currentPage, pageSize: 20, totalPages: 1 } as Awaited<ReturnType<typeof getNewsPage>>;
  let fetchError: string | null = null;

  if (hasAnyNewsSource) {
    try {
      pageResult = await getNewsPage({ page: currentPage, pageSize: 20, categorySlug, tagSlug });
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

  const categoryName =
    categorySlug
      ? pageResult.items
          .flatMap((item) => item.categories)
          .find((category) => category.slug === categorySlug)
          ?.name ?? slugToLabel(categorySlug)
      : null;
  const pageHeading = categoryName ? `${categoryName}の一覧` : "アイドルニュース";

  const rangeStart = pageResult.items.length > 0 ? (pageResult.page - 1) * pageResult.pageSize + 1 : 0;
  const rangeEnd = pageResult.items.length > 0 ? rangeStart + pageResult.items.length - 1 : 0;

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-12 sm:px-12">
      <div className="mb-8">
        <h1 className="font-mincho-jp text-3xl font-semibold tracking-tight sm:text-4xl">{pageHeading}</h1>
        <p className="mt-3 text-sm text-[var(--ui-text-subtle)]">
          公開順：{rangeStart}〜{rangeEnd}（{pageResult.page}／{pageResult.totalPages}）
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
      ) : pageResult.items.length === 0 ? (
        <div className="rounded-xl border border-[var(--ui-border)] bg-[var(--ui-panel)] p-5 text-sm text-[var(--ui-text-subtle)]">
          記事が取得できませんでした。
        </div>
      ) : (
        <>
          <div className="mb-4">
            <PaginationNav
              page={pageResult.page}
              totalPages={pageResult.totalPages}
              categorySlug={categorySlug}
              tagSlug={tagSlug}
              align="right"
            />
          </div>

          <div className="divide-y divide-zinc-400">
            {pageResult.items.map((article) => (
              <article
                key={article.path}
                className="grid gap-4 py-5 sm:grid-cols-[180px_minmax(0,1fr)]"
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
                          href={buildNewsHref({ category: category.slug, tag: tagSlug })}
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
                            href={buildNewsHref({ tag: tag.slug, category: categorySlug })}
                            className="rounded-full border border-zinc-400 px-2 py-1 text-xs text-[var(--ui-text)]"
                          >
                            {tag.name}
                          </Link>
                        ) : (
                          <span
                            key={tag.id}
                            className="rounded-full border border-zinc-400 px-2 py-1 text-xs text-[var(--ui-text)]"
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

          <div className="mt-8">
            <PaginationNav
              page={pageResult.page}
              totalPages={pageResult.totalPages}
              categorySlug={categorySlug}
              tagSlug={tagSlug}
              align="center"
            />
          </div>
        </>
      )}
    </main>
  );
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams?: SearchParams;
}): Promise<Metadata> {
  const resolvedSearchParams = (await searchParams) ?? {};
  const categoryParam = firstParam(resolvedSearchParams.category);
  const categorySlug = categoryParam?.trim() || undefined;

  if (!categorySlug) {
    return {
      title: `アイドルニュースの一覧${NEWS_LIST_TITLE_SUFFIX}`,
    };
  }

  return {
    title: `${slugToLabel(categorySlug)}の一覧${NEWS_LIST_TITLE_SUFFIX}`,
  };
}
