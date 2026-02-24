import type { Metadata } from "next";
import type { NewsArticle } from "./types";

type CanonicalStrategy = "self" | "source-url";

type BuildArticleMetadataOptions = {
  canonicalStrategy?: CanonicalStrategy;
  fallbackTitle?: string;
  siteName?: string | null;
};

function stripHtml(html: string) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function buildSeoTitle(articleTitle: string, siteName?: string | null) {
  const trimmedSiteName = typeof siteName === "string" ? siteName.trim() : "";
  return trimmedSiteName ? `${articleTitle} | ${trimmedSiteName}` : articleTitle;
}

export function buildArticleMetadata(
  article: NewsArticle | null,
  options: BuildArticleMetadataOptions = {}
): Metadata {
  const fallbackTitle = options.fallbackTitle ?? "News";
  if (!article) {
    return { title: fallbackTitle };
  }

  const articleTitle = stripHtml(article.titleHtml);
  const descriptionSource = article.excerptHtml || article.contentHtml;
  const description = stripHtml(descriptionSource).slice(0, 140);
  const canonicalStrategy = options.canonicalStrategy ?? "self";
  const canonicalUrl =
    canonicalStrategy === "source-url"
      ? article.url ?? article.path
      : article.path;
  const title = buildSeoTitle(articleTitle, options.siteName);
  const imageUrl = article.featuredImageUrl ?? undefined;

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      type: "article",
      title,
      description,
      publishedTime: article.publishedAt ?? undefined,
      images: imageUrl ? [{ url: imageUrl }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: imageUrl ? [imageUrl] : undefined,
    },
  };
}

export function stripHtmlForText(value: string) {
  return stripHtml(value);
}
