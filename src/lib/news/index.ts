import { paginateNewsArchive } from "./pagination";
import type { NewsArticle } from "./types";
import { getSanityNewsList, getSanityNewsArchive } from "./sanity";
import { getWpNewsList, getWpNewsArchiveIndex, getWpNewsArchiveArticles } from "./wp";

export type GetNewsListOptions = {
  limit?: number;
  categorySlug?: string;
  tagSlug?: string;
};

export type GetNewsPageOptions = {
  page?: number;
  pageSize?: number;
  categorySlug?: string;
  tagSlug?: string;
};

export type NewsPageResult = {
  items: NewsArticle[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

function sourcePriority(source: NewsArticle["source"]) {
  if (source === "sanity_wp_import") return 3;
  if (source === "sanity") return 2;
  return 1;
}

function dedupeByPathPreferSource(items: NewsArticle[]): NewsArticle[] {
  const map = new Map<string, NewsArticle>();
  for (const item of items) {
    const existing = map.get(item.path);
    if (!existing || sourcePriority(item.source) > sourcePriority(existing.source)) {
      map.set(item.path, item);
    }
  }
  return Array.from(map.values());
}

export async function getNewsList(options: GetNewsListOptions = {}): Promise<NewsArticle[]> {
  const {limit = 10, categorySlug, tagSlug} = options;

  const [wpResult, sanityResult] = await Promise.allSettled([
    getWpNewsList(limit),
    getSanityNewsList(limit),
  ]);

  const wpArticles = wpResult.status === "fulfilled" ? wpResult.value : [];
  const sanityArticles = sanityResult.status === "fulfilled" ? sanityResult.value : [];

  if (wpResult.status === "rejected" && sanityResult.status === "rejected") {
    throw wpResult.reason instanceof Error
      ? wpResult.reason
      : sanityResult.reason instanceof Error
        ? sanityResult.reason
        : new Error("Failed to fetch both WP and Sanity news sources");
  }

  const filtered = dedupeByPathPreferSource([...wpArticles, ...sanityArticles]).filter((article) => {
    const categoryMatch = categorySlug
      ? article.categories.some((category) => category.slug === categorySlug)
      : true;
    const tagMatch = tagSlug ? article.tags.some((tag) => tag.slug === tagSlug) : true;
    return categoryMatch && tagMatch;
  });

  return filtered
    .sort((a, b) => {
      const aTime = a.publishedAt ? Date.parse(a.publishedAt) : 0;
      const bTime = b.publishedAt ? Date.parse(b.publishedAt) : 0;
      return bTime - aTime;
    })
    .slice(0, limit);
}

export async function getNewsPage(options: GetNewsPageOptions = {}): Promise<NewsPageResult> {
  const page = Number.isFinite(options.page) ? Math.max(1, Math.trunc(options.page!)) : 1;
  const pageSize = Number.isFinite(options.pageSize) ? Math.min(100, Math.max(1, Math.trunc(options.pageSize!))) : 20;
  const categorySlug = options.categorySlug?.trim() || undefined;
  const tagSlug = options.tagSlug?.trim() || undefined;

  // A failed source must fail the request, rather than shrink the archive to
  // the remaining source and silently move the user onto a different page.
  const [wpIndex, sanityArticles] = await Promise.all([
    getWpNewsArchiveIndex({categorySlug, tagSlug}),
    getSanityNewsArchive({categorySlug, tagSlug}),
  ]);
  return paginateNewsArchive({page, pageSize, wpIndex, sanityArticles, loadWpArticles: getWpNewsArchiveArticles});
}
