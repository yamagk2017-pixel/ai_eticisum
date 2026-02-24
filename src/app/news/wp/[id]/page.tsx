import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { WpArticleBody } from "@/components/news/wp-article-body";
import { getWpNewsById } from "@/lib/news/wp";
import { hasWpApiBaseUrlConfigured, WpClientError } from "@/lib/wp/client";

export const dynamic = "force-dynamic";

type Params =
  | { id: string }
  | Promise<{ id: string }>;

function formatDate(value: string | null) {
  if (!value) return "-";
  const time = Date.parse(value);
  if (Number.isNaN(time)) return value;
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(time));
}

function stripHtml(html: string) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function TermPills({
  items,
  kind,
  variant = "default",
}: {
  items: Array<{ id: number; name: string; slug: string | null }>;
  kind: "category" | "tag";
  variant?: "default" | "plain";
}) {
  if (items.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <Link
          key={item.id}
          href={kind === "category" ? `/news?category=${item.id}` : `/news?tag=${item.id}`}
          className={
            variant === "plain"
              ? "text-xs text-[var(--ui-text)] underline underline-offset-2"
              : "rounded-full border border-[var(--ui-border)] bg-[var(--ui-panel-soft)] px-2.5 py-1 text-xs text-[var(--ui-text)]"
          }
          title={item.slug ?? undefined}
        >
          {item.name}
        </Link>
      ))}
    </div>
  );
}

async function loadArticle(idParam: string) {
  if (!/^\d+$/.test(idParam)) return null;
  return getWpNewsById(Number(idParam));
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const resolved = await params;
  let article = null;
  try {
    article = await loadArticle(resolved.id);
  } catch {
    return {
      title: "News",
    };
  }
  if (!article) {
    return {
      title: "News",
    };
  }

  const descriptionSource = article.excerptHtml || article.contentHtml;
  const description = stripHtml(descriptionSource).slice(0, 140);
  const fallbackCanonicalPath = `/news/wp/${article.id}`;
  const canonicalUrl = article.url ?? fallbackCanonicalPath;
  const articleTitle = stripHtml(article.titleHtml);

  return {
    title: articleTitle,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      type: "article",
      title: articleTitle,
      description,
      publishedTime: article.date ?? undefined,
      images: [{ url: article.featuredImageUrl! }],
    },
    twitter: {
      card: "summary_large_image",
      title: articleTitle,
      description,
      images: [article.featuredImageUrl!],
    },
  };
}

export default async function WpNewsArticlePage({
  params,
}: {
  params: Params;
}) {
  const resolved = await params;
  const hasWpBaseUrl = hasWpApiBaseUrlConfigured();
  let article = null;
  let fetchErrorMessage: string | null = null;

  if (!hasWpBaseUrl) {
    fetchErrorMessage = "`WP_API_BASE_URL` が未設定です。";
  } else {
    try {
      article = await loadArticle(resolved.id);
    } catch (error) {
      if (error instanceof WpClientError) {
        fetchErrorMessage =
          error.kind === "timeout"
            ? "WordPress APIの応答がタイムアウトしました。時間をおいて再試行してください。"
            : "WordPress APIから記事を取得できませんでした。";
      } else {
        fetchErrorMessage = "記事取得中に予期しないエラーが発生しました。";
      }
    }
  }

  if (fetchErrorMessage) {
    return (
      <main className="mx-auto w-full max-w-6xl px-6 py-12 sm:px-12">
        <div className="rounded-2xl border border-rose-300/70 bg-rose-50 p-6 dark:border-rose-800/60 dark:bg-rose-950/30">
          <p className="text-sm text-rose-900 dark:text-rose-200">{fetchErrorMessage}</p>
          <p className="mt-2 text-xs text-rose-800/80 dark:text-rose-300/80">対象記事ID: {resolved.id}</p>
          <div className="mt-4">
            <Link href="/news" className="text-sm underline underline-offset-2">
              News一覧へ
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (!article) notFound();

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-12 sm:px-12">
      <article>
        <div className="mb-6 space-y-3">
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-xs text-[var(--ui-text-subtle)]">
            <Link href="/" className="underline underline-offset-2">Home</Link>
            <span>&gt;</span>
            <Link href="/news" className="underline underline-offset-2">News</Link>
            {article.categories[0] ? (
              <>
                <span>&gt;</span>
                <Link
                  href={`/news?category=${article.categories[0].id}`}
                  className="underline underline-offset-2"
                >
                  {article.categories[0].name}
                </Link>
              </>
            ) : null}
            <span>&gt;</span>
            <span className="max-w-full truncate text-[var(--ui-text)]">{stripHtml(article.titleHtml)}</span>
          </nav>
        </div>

        <div className="md:grid md:grid-cols-[minmax(0,1fr)_40%] md:items-start md:gap-8">
          {article.featuredImageUrl ? (
            <div className="md:order-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={article.featuredImageUrl}
                alt={article.featuredImageAlt ?? ""}
                className="h-auto w-full rounded-xl object-contain"
              />
            </div>
          ) : null}

          <div className={article.featuredImageUrl ? "md:order-1" : undefined}>
            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 md:mt-0">
                <p className="text-xs tracking-wide text-[var(--ui-text-subtle)]">{formatDate(article.date)}</p>
                <div className="mt-0">
                  <TermPills items={article.categories} kind="category" variant="plain" />
                </div>
              </div>

            <h1
              className="mt-4 font-mincho-jp text-2xl font-semibold leading-tight sm:text-3xl"
              dangerouslySetInnerHTML={{ __html: article.titleHtml }}
            />

              <div className="mt-4">
                <TermPills items={article.tags} kind="tag" />
              </div>
            </div>
          </div>

        <div className="pt-6">
          <WpArticleBody html={article.contentHtml} />
        </div>
      </article>
    </main>
  );
}
