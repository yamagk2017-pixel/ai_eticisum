import {groq} from "next-sanity";
import {sanityClient} from "@/lib/sanity/client";
import {hasSanityStudioEnv} from "@/sanity/env";
import type {NewsArticle, NewsTag} from "./types";

type SanityRefTag = {
  _id: string;
  title?: string | null;
  slug?: {current?: string | null} | null;
};

type SanityNewsArticleListDoc = {
  _id: string;
  title?: string | null;
  slug?: {current?: string | null} | null;
  publishedAt?: string | null;
  excerpt?: string | null;
  heroImageUrl?: string | null;
  categories?: SanityRefTag[] | null;
  tags?: SanityRefTag[] | null;
};

export type SanityRelatedGroup = {
  groupNameJa: string;
  imdGroupId?: string | null;
  displayOrder?: number | null;
};

export type SanityNewsArticleDetail = {
  id: string;
  slug: string;
  path: string;
  title: string;
  titleHtml: string;
  publishedAt: string | null;
  excerpt: string | null;
  featuredImageUrl: string | null;
  categories: NewsTag[];
  tags: NewsTag[];
  body: unknown;
  relatedGroups: SanityRelatedGroup[];
};

const listQuery = groq`
  *[_type == "newsArticle" && defined(slug.current)]
  | order(publishedAt desc)[0...$limit]{
    _id,
    title,
    slug,
    publishedAt,
    excerpt,
    "heroImageUrl": heroImage.asset->url,
    "categories": categories[]->{
      _id,
      title,
      slug
    },
    "tags": tags[]->{
      _id,
      title,
      slug
    }
  }
`;

const bySlugQuery = groq`
  *[_type == "newsArticle" && slug.current == $slug][0]{
    _id,
    title,
    slug,
    publishedAt,
    excerpt,
    body,
    "heroImageUrl": heroImage.asset->url,
    "categories": categories[]->{
      _id,
      title,
      slug
    },
    "tags": tags[]->{
      _id,
      title,
      slug
    },
    "relatedGroups": relatedGroups[]{
      groupNameJa,
      imdGroupId,
      displayOrder
    }
  }
`;

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function mapRefTags(items: SanityRefTag[] | null | undefined): NewsTag[] {
  return (items ?? [])
    .filter((item): item is SanityRefTag & {_id: string} => Boolean(item?._id && item?.title))
    .map((item) => ({
      // List UI only needs stable key + link target fallback; Sanity IDs are string, map to synthetic numeric hash.
      id: Math.abs(
        Array.from(item._id).reduce((acc, char) => ((acc << 5) - acc + char.charCodeAt(0)) | 0, 0)
      ),
      name: item.title ?? "(untitled)",
      slug: item.slug?.current ?? null,
    }));
}

function mapListDocToNewsArticle(doc: SanityNewsArticleListDoc): NewsArticle | null {
  const slug = doc.slug?.current?.trim();
  if (!slug) return null;
  const title = (doc.title ?? "").trim() || "(untitled)";

  return {
    source: "sanity",
    routeType: "sanity-slug",
    path: `/news/${slug}`,
    // Keep NewsArticle compatible with existing list/detail SEO helpers. Sanity IDs are not numeric, so use a stable hash.
    id: Math.abs(Array.from(doc._id).reduce((acc, c) => ((acc << 5) - acc + c.charCodeAt(0)) | 0, 0)),
    slug,
    url: null,
    publishedAt: doc.publishedAt ?? null,
    titleHtml: escapeHtml(title),
    excerptHtml: escapeHtml((doc.excerpt ?? "").trim()),
    contentHtml: "",
    featuredImageUrl: doc.heroImageUrl ?? null,
    featuredImageAlt: null,
    categories: mapRefTags(doc.categories),
    tags: mapRefTags(doc.tags),
  };
}

export async function getSanityNewsList(limit = 10): Promise<NewsArticle[]> {
  if (!hasSanityStudioEnv()) return [];
  const docs = await sanityClient.fetch<SanityNewsArticleListDoc[]>(listQuery, {limit});
  return docs.map(mapListDocToNewsArticle).filter((item): item is NewsArticle => Boolean(item));
}

export async function getSanityNewsBySlug(slug: string): Promise<SanityNewsArticleDetail | null> {
  if (!hasSanityStudioEnv()) return null;
  const trimmed = slug.trim();
  if (!trimmed) return null;

  const doc = await sanityClient.fetch<{
    _id: string;
    title?: string | null;
    slug?: {current?: string | null} | null;
    publishedAt?: string | null;
    excerpt?: string | null;
    body?: unknown;
    heroImageUrl?: string | null;
    categories?: SanityRefTag[] | null;
    tags?: SanityRefTag[] | null;
    relatedGroups?: SanityRelatedGroup[] | null;
  } | null>(bySlugQuery, {slug: trimmed});

  if (!doc) return null;

  const currentSlug = doc.slug?.current?.trim();
  if (!currentSlug) return null;
  const title = (doc.title ?? "").trim() || "(untitled)";

  return {
    id: doc._id,
    slug: currentSlug,
    path: `/news/${currentSlug}`,
    title,
    titleHtml: escapeHtml(title),
    publishedAt: doc.publishedAt ?? null,
    excerpt: doc.excerpt ?? null,
    featuredImageUrl: doc.heroImageUrl ?? null,
    categories: mapRefTags(doc.categories),
    tags: mapRefTags(doc.tags),
    body: doc.body ?? [],
    relatedGroups: (doc.relatedGroups ?? []).filter(
      (item): item is SanityRelatedGroup => Boolean(item?.groupNameJa)
    ),
  };
}
