import {groq} from "next-sanity";
import {sanityClient} from "@/lib/sanity/client";
import {hasSanityStudioEnv} from "@/sanity/env";
import type {NewsArticle, NewsRelatedGroupRef, NewsTag} from "./types";

type SanityRefTag = {
  _id: string;
  title?: string | null;
  slug?: {current?: string | null} | null;
};

type SanityNewsArticleListDoc = {
  _type?: "newsArticle" | "wpImportedArticle";
  _id: string;
  title?: string | null;
  slug?: {current?: string | null} | null;
  wpPostId?: number | null;
  originalWpUrl?: string | null;
  publishedAt?: string | null;
  excerpt?: string | null;
  heroImageUrl?: string | null;
  categories?: SanityRefTag[] | null;
  tags?: SanityRefTag[] | null;
};

export type SanityRelatedGroup = NewsRelatedGroupRef;

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
  *[
    _type in ["newsArticle", "wpImportedArticle"] &&
    (
      (_type == "newsArticle" && defined(slug.current)) ||
      (_type == "wpImportedArticle" && defined(wpPostId))
    ) &&
    !(_id in path("drafts.**")) &&
    !defined(*[_id == ("drafts." + ^._id)][0]._id) &&
    (!defined($categorySlug) || count((categories[]->slug.current)[@ == $categorySlug]) > 0) &&
    (!defined($tagSlug) || count((tags[]->slug.current)[@ == $tagSlug]) > 0)
  ]
  | order(publishedAt desc)[$start...$end]{
    _type,
    _id,
    title,
    slug,
    wpPostId,
    originalWpUrl,
    publishedAt,
    excerpt,
    "heroImageUrl": coalesce(heroImage.asset->url, heroImageExternalUrl),
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

const countQuery = groq`
  count(*[
    _type in ["newsArticle", "wpImportedArticle"] &&
    (
      (_type == "newsArticle" && defined(slug.current)) ||
      (_type == "wpImportedArticle" && defined(wpPostId))
    ) &&
    !(_id in path("drafts.**")) &&
    !defined(*[_id == ("drafts." + ^._id)][0]._id) &&
    (!defined($categorySlug) || count((categories[]->slug.current)[@ == $categorySlug]) > 0) &&
    (!defined($tagSlug) || count((tags[]->slug.current)[@ == $tagSlug]) > 0)
  ])
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

const wpImportedByPostIdQuery = groq`
  *[_type == "wpImportedArticle" && wpPostId == $wpPostId][0]{
    _id,
    title,
    publishedAt,
    excerpt,
    legacyBodyHtml,
    originalWpUrl,
    wpPostId,
    "heroImageUrl": coalesce(heroImage.asset->url, heroImageExternalUrl),
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
  const title = (doc.title ?? "").trim() || "(untitled)";

  if (doc._type === "wpImportedArticle") {
    if (!Number.isFinite(doc.wpPostId)) return null;
    const wpPostId = Number(doc.wpPostId);
    return {
      source: "sanity_wp_import",
      routeType: "wp-id",
      path: `/news/wp/${wpPostId}`,
      id: wpPostId,
      slug: String(wpPostId),
      url: doc.originalWpUrl ?? null,
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

  const slug = doc.slug?.current?.trim();
  if (!slug) return null;

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
  const docs = await sanityClient.fetch<SanityNewsArticleListDoc[]>(listQuery, {
    start: 0,
    end: limit,
    categorySlug: null,
    tagSlug: null,
  });
  return docs.map(mapListDocToNewsArticle).filter((item): item is NewsArticle => Boolean(item));
}

export async function getSanityNewsPage(options: {
  page: number;
  pageSize: number;
  categorySlug?: string;
  tagSlug?: string;
}): Promise<{items: NewsArticle[]; total: number}> {
  if (!hasSanityStudioEnv()) return {items: [], total: 0};
  const page = Math.max(1, Math.trunc(options.page || 1));
  const pageSize = Math.max(1, Math.min(100, Math.trunc(options.pageSize || 20)));
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const categorySlug = options.categorySlug?.trim() || null;
  const tagSlug = options.tagSlug?.trim() || null;

  const [docs, total] = await Promise.all([
    sanityClient.fetch<SanityNewsArticleListDoc[]>(listQuery, {start, end, categorySlug, tagSlug}),
    sanityClient.fetch<number>(countQuery, {categorySlug, tagSlug}),
  ]);

  return {
    items: docs.map(mapListDocToNewsArticle).filter((item): item is NewsArticle => Boolean(item)),
    total: Number(total ?? 0),
  };
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

export async function getSanityWpImportedNewsByWpPostId(wpPostId: number): Promise<NewsArticle | null> {
  if (!hasSanityStudioEnv()) return null;
  if (!Number.isFinite(wpPostId) || wpPostId <= 0) return null;

  const doc = await sanityClient.fetch<{
    _id: string;
    title?: string | null;
    publishedAt?: string | null;
    excerpt?: string | null;
    legacyBodyHtml?: string | null;
    originalWpUrl?: string | null;
    wpPostId?: number | null;
    heroImageUrl?: string | null;
    categories?: SanityRefTag[] | null;
    tags?: SanityRefTag[] | null;
    relatedGroups?: SanityRelatedGroup[] | null;
  } | null>(wpImportedByPostIdQuery, {wpPostId});

  if (!doc || !Number.isFinite(doc.wpPostId)) return null;
  const title = (doc.title ?? "").trim() || "(untitled)";

  return {
    source: "sanity_wp_import",
    routeType: "wp-id",
    path: `/news/wp/${doc.wpPostId}`,
    id: Number(doc.wpPostId),
    slug: String(doc.wpPostId),
    url: doc.originalWpUrl ?? null,
    publishedAt: doc.publishedAt ?? null,
    titleHtml: escapeHtml(title),
    excerptHtml: escapeHtml((doc.excerpt ?? "").trim()),
    contentHtml: doc.legacyBodyHtml ?? "",
    featuredImageUrl: doc.heroImageUrl ?? null,
    featuredImageAlt: null,
    categories: mapRefTags(doc.categories),
    tags: mapRefTags(doc.tags),
    relatedGroups: (doc.relatedGroups ?? []).filter(
      (item): item is SanityRelatedGroup => Boolean(item?.groupNameJa)
    ),
  };
}
