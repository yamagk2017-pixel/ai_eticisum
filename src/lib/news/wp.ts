import {
  fetchWpPostsListPage,
  fetchWpPostIndexPage,
  fetchWpArchivePostsByIds,
  fetchWpPostById,
  fetchWpPostsList,
  fetchWpTermIdBySlug,
  type WpPost,
} from "@/lib/wp/client";
import type { NewsArticle } from "./types";

function toNewsArticle(post: WpPost): NewsArticle {
  return {
    source: "wp",
    routeType: "wp-id",
    path: `/news/wp/${post.id}`,
    id: post.id,
    slug: post.slug,
    url: post.url,
    publishedAt: post.date,
    titleHtml: post.titleHtml,
    excerptHtml: post.excerptHtml,
    contentHtml: post.contentHtml,
    featuredImageUrl: post.featuredImageUrl,
    featuredImageAlt: post.featuredImageAlt,
    categories: post.categories,
    tags: post.tags,
  };
}

export async function getWpNewsList(
  limit = 10,
  filters?: { categoryId?: number; tagId?: number }
): Promise<NewsArticle[]> {
  const posts = await fetchWpPostsList(limit, filters);
  return posts.map(toNewsArticle);
}

export async function getWpNewsPage(options: {
  page: number;
  pageSize: number;
  categorySlug?: string;
  tagSlug?: string;
}): Promise<{items: NewsArticle[]; total: number}> {
  const {page, pageSize, categorySlug, tagSlug} = options;

  const [categoryId, tagId] = await Promise.all([
    categorySlug ? fetchWpTermIdBySlug("categories", categorySlug) : Promise.resolve(null),
    tagSlug ? fetchWpTermIdBySlug("tags", tagSlug) : Promise.resolve(null),
  ]);

  if (categorySlug && !categoryId) return {items: [], total: 0};
  if (tagSlug && !tagId) return {items: [], total: 0};

  const result = await fetchWpPostsListPage(pageSize, page, {
    categoryId: categoryId ?? undefined,
    tagId: tagId ?? undefined,
  });

  return {
    items: result.posts.map(toNewsArticle),
    total: result.total,
  };
}

export async function getWpNewsById(id: number): Promise<NewsArticle | null> {
  const post = await fetchWpPostById(id);
  return post ? toNewsArticle(post) : null;
}

export { toNewsArticle as mapWpPostToNewsArticle };

export async function getWpNewsArchiveIndex(filters: {categorySlug?: string; tagSlug?: string}) {
  const [categoryId, tagId] = await Promise.all([
    filters.categorySlug ? fetchWpTermIdBySlug("categories", filters.categorySlug) : null,
    filters.tagSlug ? fetchWpTermIdBySlug("tags", filters.tagSlug) : null,
  ]);
  if ((filters.categorySlug && !categoryId) || (filters.tagSlug && !tagId)) return [];
  const options = {categoryId: categoryId ?? undefined, tagId: tagId ?? undefined};
  const first = await fetchWpPostIndexPage(1, options);
  const items = [...first.items];
  // Bound concurrency so a cold archive request does not overwhelm WordPress.
  for (let page = 2; page <= first.totalPages; page += 4) {
    const pages = await Promise.all(
      Array.from({length: Math.min(4, first.totalPages - page + 1)}, (_, offset) =>
        fetchWpPostIndexPage(page + offset, options)
      )
    );
    for (const result of pages) items.push(...result.items);
  }
  return items;
}

export async function getWpNewsArchiveArticles(ids: number[]) {
  return (await fetchWpArchivePostsByIds(ids)).map(toNewsArticle);
}
