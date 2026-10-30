import type {NewsArticle} from "./types";

type ArchiveEntry = {
  path: string;
  publishedAt: string | null;
  wpId?: number;
  article?: NewsArticle;
};

export async function paginateNewsArchive({page, pageSize, wpIndex, sanityArticles, loadWpArticles}: {
  page: number;
  pageSize: number;
  wpIndex: Array<{id: number; publishedAt: string | null}>;
  sanityArticles: NewsArticle[];
  loadWpArticles: (ids: number[]) => Promise<NewsArticle[]>;
}) {
  const entries = new Map<string, ArchiveEntry>();
  for (const item of wpIndex) {
    const path = `/news/wp/${item.id}`;
    entries.set(path, {path, publishedAt: item.publishedAt, wpId: item.id});
  }
  // Imported Sanity articles replace their WordPress counterparts by URL.
  for (const article of sanityArticles) {
    const existing = entries.get(article.path)?.article;
    if (existing?.source === "sanity_wp_import" && article.source !== "sanity_wp_import") continue;
    entries.set(article.path, {path: article.path, publishedAt: article.publishedAt, article});
  }
  const ordered = [...entries.values()].sort((a, b) => {
    const time = (value: string | null) => (value ? Date.parse(value) || 0 : 0);
    return time(b.publishedAt) - time(a.publishedAt) || a.path.localeCompare(b.path);
  });
  const total = ordered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const selected = ordered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const ids = selected.flatMap((entry) => entry.wpId === undefined ? [] : [entry.wpId]);
  const wpArticles = ids.length > 0 ? await loadWpArticles(ids) : [];
  const byPath = new Map(wpArticles.map((article) => [article.path, article]));
  const items = selected.map((entry) => {
    const article = entry.article ?? byPath.get(entry.path);
    if (!article) throw new Error(`Archive article unavailable: ${entry.path}`);
    return article;
  });
  return {items, total, page: safePage, pageSize, totalPages};
}
