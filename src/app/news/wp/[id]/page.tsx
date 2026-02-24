import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { WpArticleBody } from "@/components/news/wp-article-body";
import { getWpNewsById } from "@/lib/news/wp";

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
  variant = "default",
}: {
  items: Array<{ id: number; name: string; slug: string | null }>;
  variant?: "default" | "plain";
}) {
  if (items.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span
          key={item.id}
          className={
            variant === "plain"
              ? "text-xs text-[var(--ui-text)]"
              : "rounded-full border border-[var(--ui-border)] bg-[var(--ui-panel-soft)] px-2.5 py-1 text-xs text-[var(--ui-text)]"
          }
          title={item.slug ?? undefined}
        >
          {item.name}
        </span>
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
  const article = await loadArticle(resolved.id);
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
  const article = await loadArticle(resolved.id);

  if (!article) notFound();

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-12 sm:px-12">
      <article>
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
                <TermPills items={article.categories} variant="plain" />
              </div>
            </div>

            <h1
              className="mt-4 font-mincho-jp text-2xl font-semibold leading-tight sm:text-3xl"
              dangerouslySetInnerHTML={{ __html: article.titleHtml }}
            />

            <div className="mt-4">
              <TermPills items={article.tags} />
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
