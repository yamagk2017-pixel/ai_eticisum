import type { NewsArticle } from "./types";
import { getSanityNewsList, getSanityNewsPage } from "./sanity";
import { getWpNewsList, getWpNewsPage } from "./wp";

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

export async function getNewsList(options: GetNewsListOptions = {}): Promise<NewsArticle[]> {
  const {limit = 10, categorySlug, tagSlug} = options;

  const [wpArticles, sanityArticles] = await Promise.all([
    getWpNewsList(limit),
    getSanityNewsList(limit),
  ]);

  const filtered = [...wpArticles, ...sanityArticles].filter((article) => {
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

  const prefetchLimit = page * pageSize;

  const [wpPage, sanityPage] = await Promise.all([
    getWpNewsPage({page: 1, pageSize: prefetchLimit, categorySlug, tagSlug}),
    getSanityNewsPage({page: 1, pageSize: prefetchLimit, categorySlug, tagSlug}),
  ]);

  const merged = [...wpPage.items, ...sanityPage.items].sort((a, b) => {
    const aTime = a.publishedAt ? Date.parse(a.publishedAt) : 0;
    const bTime = b.publishedAt ? Date.parse(b.publishedAt) : 0;
    return bTime - aTime;
  });

  const total = wpPage.total + sanityPage.total;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const items = merged.slice(start, start + pageSize);

  return {items, total, page: safePage, pageSize, totalPages};
}
