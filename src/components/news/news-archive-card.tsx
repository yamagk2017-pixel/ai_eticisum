import Link from "next/link";
import type {NewsArticle} from "@/lib/news/types";
import {formatNewsDate} from "@/lib/news/datetime";

function buildNewsHref(params: {category?: string; tag?: string}) {
  const search = new URLSearchParams();
  if (params.category) search.set("category", params.category);
  if (params.tag) search.set("tag", params.tag);
  const query = search.toString();
  return query ? `/news?${query}` : "/news";
}

export function NewsArchiveCard({article, categorySlug, tagSlug, titleAs: Title = "h2"}: {
  article: NewsArticle;
  categorySlug?: string;
  tagSlug?: string;
  titleAs?: "h2" | "h3";
}) {
  return (
    <article
      className="flex h-[460px] min-w-0 flex-col overflow-hidden rounded-xl border border-[var(--ui-border)] bg-[var(--ui-panel)]"
    >
      <Link href={article.path} className="block h-60 shrink-0 overflow-hidden">
        {article.featuredImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={article.featuredImageUrl}
            alt={article.featuredImageAlt ?? ""}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-[var(--ui-panel-soft)] text-xs text-[var(--ui-text-subtle)]">
            No Image
          </div>
        )}
      </Link>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col p-4">
        <div className="mb-2 flex h-9 shrink-0 flex-wrap content-start items-center gap-x-3 gap-y-1 overflow-hidden text-xs text-[var(--ui-text-subtle)]">
          <span>{formatNewsDate(article.publishedAt, {dateStyle: "medium", timeStyle: "short"})}</span>
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
          <Title
            className="line-clamp-3 font-mincho-jp text-lg font-semibold leading-snug text-[var(--ui-text)] underline decoration-zinc-400 underline-offset-4 dark:decoration-zinc-500"
            dangerouslySetInnerHTML={{ __html: article.titleHtml }}
          />
        </Link>

        {article.tags.length > 0 ? (
          <div className="mt-auto flex max-h-8 shrink-0 flex-wrap gap-2 overflow-hidden pt-1">
            {article.tags.slice(0, 4).map((tag) =>
              tag.slug ? (
                <Link
                  key={tag.id}
                  href={buildNewsHref({ tag: tag.slug, category: categorySlug })}
                  className="max-w-full truncate rounded-full border border-zinc-400 px-2 py-1 text-xs text-[var(--ui-text)]"
                >
                  {tag.name}
                </Link>
              ) : (
                <span
                  key={tag.id}
                  className="max-w-full truncate rounded-full border border-zinc-400 px-2 py-1 text-xs text-[var(--ui-text)]"
                >
                  {tag.name}
                </span>
              )
            )}
          </div>
        ) : null}
      </div>
    </article>
  );
}
