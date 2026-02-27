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
  return (
    <li className="text-sm text-[var(--ui-text)]">
      <Link href={article.path} className="underline underline-offset-2">
        {article.title}
      </Link>
      {dateText ? <span className="ml-2 text-xs text-[var(--ui-text-subtle)]">({dateText})</span> : null}
    </li>
  );
}

export function ArticleCitations({
  citationSourceArticle,
  citedByArticles,
}: {
  citationSourceArticle?: NewsRelatedArticleRef | null;
  citedByArticles?: NewsRelatedArticleRef[];
}) {
  const hasSource = Boolean(citationSourceArticle);
  const citedBy = citedByArticles ?? [];
  const hasCitedBy = citedBy.length > 0;

  if (!hasSource && !hasCitedBy) return null;

  return (
    <section className="mt-8 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-panel-soft)] p-4 sm:p-5">
      {hasSource ? (
        <div>
          <p className="text-xs font-medium tracking-wide text-[var(--ui-text-subtle)]">引用元の記事</p>
          <ul className="mt-2 space-y-1">
            <RelatedArticleItem article={citationSourceArticle!} />
          </ul>
        </div>
      ) : null}

      {hasCitedBy ? (
        <div className={hasSource ? "mt-5 border-t border-[var(--ui-border)] pt-4" : ""}>
          <p className="text-xs font-medium tracking-wide text-[var(--ui-text-subtle)]">この記事を引用している記事</p>
          <ul className="mt-2 space-y-1">
            {citedBy.map((article) => (
              <RelatedArticleItem key={`${article.path}-${article.title}`} article={article} />
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
