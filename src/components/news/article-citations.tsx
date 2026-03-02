import Link from "next/link";
import type {NewsRelatedArticleRef} from "@/lib/news/types";

function formatDate(value: string | null) {
  if (!value) return null;
  const time = Date.parse(value);
  if (Number.isNaN(time)) return value;
  return new Intl.DateTimeFormat("ja-JP", {dateStyle: "medium"}).format(new Date(time));
}

function RelatedArticleItem({article}: {article: NewsRelatedArticleRef}) {
  const dateText = formatDate(article.publishedAt);
  const categories = article.categories ?? [];
  const tags = article.tags ?? [];
  return (
    <li className="grid gap-3 py-4 sm:grid-cols-[120px_minmax(0,1fr)]">
      <Link href={article.path} className="block">
        {article.featuredImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={article.featuredImageUrl}
            alt=""
            className="h-20 w-full rounded-lg object-cover sm:h-full"
          />
        ) : (
          <div className="flex h-20 items-center justify-center rounded-lg bg-[var(--ui-panel-soft)] text-xs text-[var(--ui-text-subtle)] sm:h-full">
            No Image
          </div>
        )}
      </Link>

      <div className="min-w-0">
        <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--ui-text-subtle)]">
          <span>{dateText ?? "-"}</span>
          {categories.slice(0, 2).map((category) =>
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
        <Link
          href={article.path}
          className="font-mincho-jp text-lg font-semibold leading-snug text-[var(--ui-text)] underline decoration-zinc-400 underline-offset-4 dark:decoration-zinc-500"
        >
          {article.title}
        </Link>
        {tags.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {tags.slice(0, 4).map((tag) =>
              tag.slug ? (
                <Link
                  key={tag.id}
                  href={`/news?tag=${tag.slug}`}
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
    </li>
  );
}

function CitationBlock({
  heading,
  items,
}: {
  heading: string;
  items: NewsRelatedArticleRef[];
}) {
  if (items.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="font-mincho-jp text-xl font-semibold text-[var(--ui-text)]">{heading}</h2>
      <ul className="mt-3 divide-y divide-[var(--ui-border)]">
        {items.map((article) => (
          <RelatedArticleItem key={`${article.path}-${article.title}`} article={article} />
        ))}
      </ul>
    </section>
  );
}

export function ArticleCitations({
  citationSourceArticle,
  citedByArticles,
}: {
  citationSourceArticle?: NewsRelatedArticleRef | null;
  citedByArticles?: NewsRelatedArticleRef[];
}) {
  const sourceItems = citationSourceArticle ? [citationSourceArticle] : [];
  const citedBy = citedByArticles ?? [];

  if (sourceItems.length === 0 && citedBy.length === 0) return null;

  return (
    <section className="mt-10 border-t border-dashed border-white/50 px-2 pt-0 sm:px-3">
      <CitationBlock heading="この記事の引用元" items={sourceItems} />
      <CitationBlock heading="この記事を引用している記事" items={citedBy} />
    </section>
  );
}
