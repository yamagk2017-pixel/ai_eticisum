import type { NewsArticle } from "./types";
import { getWpNewsList } from "./wp";

export type GetNewsListOptions = {
  limit?: number;
  categoryId?: number;
  tagId?: number;
};

export async function getNewsList(options: GetNewsListOptions = {}): Promise<NewsArticle[]> {
  const { limit = 10, categoryId, tagId } = options;

  // Phase 1: /news is backed by WP only.
  // Sanity sources will be merged here later and sorted by publishedAt (desc).
  return getWpNewsList(limit, { categoryId, tagId });
}
