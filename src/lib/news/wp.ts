import {
  fetchWpPostById,
  fetchWpPostsList,
  type WpPost,
} from "@/lib/wp/client";
import type { NewsArticle } from "./types";

function toNewsArticle(post: WpPost): NewsArticle {
  return {
    source: "wp",
    id: post.id,
    slug: post.slug,
    url: post.url,
    date: post.date,
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

export async function getWpNewsById(id: number): Promise<NewsArticle | null> {
  const post = await fetchWpPostById(id);
  return post ? toNewsArticle(post) : null;
}
