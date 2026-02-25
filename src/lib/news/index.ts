import type { NewsArticle } from "./types";
import { getSanityNewsList } from "./sanity";
import { getWpNewsList } from "./wp";

export type GetNewsListOptions = {
  limit?: number;
  categoryId?: number;
  tagId?: number;
};

export async function getNewsList(options: GetNewsListOptions = {}): Promise<NewsArticle[]> {
  const { limit = 10, categoryId, tagId } = options;

  // Until taxonomy IDs are unified across WP/Sanity, category/tag filter queries apply to WP only.
  if (categoryId || tagId) {
    return getWpNewsList(limit, { categoryId, tagId });
  }

  const [wpArticles, sanityArticles] = await Promise.all([
    getWpNewsList(limit),
    getSanityNewsList(limit),
  ]);

  return [...wpArticles, ...sanityArticles]
    .sort((a, b) => {
      const aTime = a.publishedAt ? Date.parse(a.publishedAt) : 0;
      const bTime = b.publishedAt ? Date.parse(b.publishedAt) : 0;
      return bTime - aTime;
    })
    .slice(0, limit);
}
