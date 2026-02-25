import type { NewsArticle } from "./types";
import { getSanityNewsList } from "./sanity";
import { getWpNewsList } from "./wp";

export type GetNewsListOptions = {
  limit?: number;
  categorySlug?: string;
  tagSlug?: string;
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
