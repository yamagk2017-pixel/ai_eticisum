import type {Metadata} from "next";
import Link from "next/link";
import {notFound} from "next/navigation";
import {SanityArticleBody} from "@/components/news/sanity-article-body";
import {buildArticleMetadata, stripHtmlForText} from "@/lib/news/seo";
import {getSanityNewsBySlug} from "@/lib/news/sanity";
import type {NewsArticle} from "@/lib/news/types";
import {hasSanityStudioEnv} from "@/sanity/env";

export const dynamic = "force-dynamic";

type Params = {slug: string} | Promise<{slug: string}>;

function formatDate(value: string | null) {
  if (!value) return "-";
  const time = Date.parse(value);
  if (Number.isNaN(time)) return value;
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(time));
}

function toSeoArticleShape(article: Awaited<ReturnType<typeof getSanityNewsBySlug>>): NewsArticle | null {
  if (!article) return null;
  return {
    source: "sanity",
    routeType: "sanity-slug",
    path: article.path,
    id: Math.abs(Array.from(article.id).reduce((acc, c) => ((acc << 5) - acc + c.charCodeAt(0)) | 0, 0)),
    slug: article.slug,
    url: null,
    publishedAt: article.publishedAt,
    titleHtml: article.titleHtml,
    excerptHtml: article.excerpt ? article.excerpt : "",
    contentHtml: "",
    featuredImageUrl: article.featuredImageUrl,
    featuredImageAlt: null,
    categories: article.categories,
    tags: article.tags,
  };
}

export async function generateMetadata({params}: {params: Params}): Promise<Metadata> {
  const resolved = await params;
  try {
    const article = await getSanityNewsBySlug(resolved.slug);
    return buildArticleMetadata(toSeoArticleShape(article), {
      fallbackTitle: "News",
      canonicalStrategy: "self",
    });
  } catch {
    return {title: "News"};
  }
}

export default async function SanityNewsArticlePage({params}: {params: Params}) {
  const resolved = await params;

  if (!hasSanityStudioEnv()) {
    return (
      <main className="mx-auto w-full max-w-6xl px-6 py-12 sm:px-12">
        <div className="rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-panel)] p-6">
          <p className="text-sm text-[var(--ui-text-subtle)]">
            Sanity環境変数が未設定のため、Sanity記事を表示できません。
          </p>
        </div>
      </main>
    );
  }

  const article = await getSanityNewsBySlug(resolved.slug);
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
                <span>{article.categories[0].name}</span>
              </>
            ) : null}
            <span>&gt;</span>
            <span className="max-w-full truncate text-[var(--ui-text)]">{stripHtmlForText(article.titleHtml)}</span>
          </nav>
        </div>

        <div className="md:grid md:grid-cols-[minmax(0,1fr)_40%] md:items-start md:gap-8">
          {article.featuredImageUrl ? (
            <div className="md:order-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={article.featuredImageUrl} alt="" className="h-auto w-full rounded-xl object-contain" />
            </div>
          ) : null}

          <div className={article.featuredImageUrl ? "md:order-1" : undefined}>
            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 md:mt-0">
              <p className="text-xs tracking-wide text-[var(--ui-text-subtle)]">{formatDate(article.publishedAt)}</p>
              {article.categories.map((category) => (
                <span key={`${article.id}-${category.name}`} className="text-xs underline underline-offset-2">
                  {category.name}
                </span>
              ))}
            </div>

            <h1
              className="mt-4 font-mincho-jp text-2xl font-semibold leading-tight sm:text-3xl"
              dangerouslySetInnerHTML={{__html: article.titleHtml}}
            />

            {article.tags.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {article.tags.map((tag) => (
                  <span
                    key={`${article.id}-${tag.name}`}
                    className="rounded-full border border-[var(--ui-border)] bg-[var(--ui-panel-soft)] px-2.5 py-1 text-xs text-[var(--ui-text)]"
                  >
                    {tag.name}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        {article.relatedGroups.length > 0 ? (
          <section className="mt-8 rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-panel)] p-4">
            <h2 className="text-sm font-semibold text-[var(--ui-text)]">Related Groups</h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {article.relatedGroups.map((group, index) => (
                <li
                  key={`${group.groupNameJa}-${index}`}
                  className="rounded-full border border-[var(--ui-border)] bg-[var(--ui-panel-soft)] px-3 py-1 text-xs text-[var(--ui-text)]"
                >
                  {group.groupNameJa}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <div className="pt-6">
          <SanityArticleBody value={article.body} />
        </div>
      </article>
    </main>
  );
}

