import {groq} from "next-sanity";
import {sanityClient} from "@/lib/sanity/client";
import {hasSanityStudioEnv} from "@/sanity/env";
import type {NewsArticle, NewsRelatedArticleRef, NewsRelatedGroupRef, NewsTag} from "./types";

type SanityRefTag = {
  _id: string;
  title?: string | null;
  slug?: {current?: string | null} | null;
};

type SanityRelatedArticleDoc = {
  _type?: "newsArticle" | "eventAnnouncement" | "radioAnnouncement" | "wpImportedArticle";
  _id: string;
  title?: string | null;
  slug?: {current?: string | null} | null;
  wpPostId?: number | null;
  publishedAt?: string | null;
  heroImageUrl?: string | null;
  categories?: SanityRefTag[] | null;
  tags?: SanityRefTag[] | null;
};

type SanityNewsArticleListDoc = {
  _type?: "newsArticle" | "eventAnnouncement" | "radioAnnouncement" | "wpImportedArticle";
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

type SanityRelatedEventHomeDoc = {
  _id: string;
  title?: string | null;
  slug?: {current?: string | null} | null;
  eventDate?: string | null;
  eventEndDate?: string | null;
  eventTimeText?: string | null;
  streamingUrl?: string | null;
  streamingDeadline?: string | null;
  ticketSalesUrl?: string | null;
  heroImageUrl?: string | null;
};

export type SanityRelatedGroup = NewsRelatedGroupRef;

export type HomeRelatedEvent = {
  id: string;
  title: string;
  path: string;
  eventDate: string | null;
  eventEndDate: string | null;
  eventTimeText: string | null;
  ticketSalesUrl: string | null;
  streamingDeadline: string | null;
  featuredImageUrl: string | null;
};

export type SanityNewsArticleDetail = {
  type: "newsArticle" | "eventAnnouncement" | "radioAnnouncement";
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
  galleryImages: Array<{
    url: string;
    alt: string | null;
    caption: string | null;
  }>;
  relatedGroups: SanityRelatedGroup[];
  eventInfo: {
    eventTitle: string | null;
    eventDate: string | null;
    eventEndDate: string | null;
    broadcastDate: string | null;
    eventTimeText: string | null;
    personality: string | null;
    eventPrice: string | null;
    officialSiteUrl: string | null;
    organizer: string | null;
    representativePerformers: Array<{
      name: string;
      groupNameJa: string | null;
      imdGroupId: string | null;
    }>;
    legacyExternalPerformers: string[];
    ticketSalesUrl: string | null;
    streamingUrl: string | null;
    archiveUrl: string | null;
    afterTalkUrl: string | null;
    streamingDeadline: string | null;
    streamingPrice: string | null;
  } | null;
  citationSourceArticle: NewsRelatedArticleRef | null;
  citedByArticles: NewsRelatedArticleRef[];
};

const listQuery = groq`
  *[
    _type in ["newsArticle", "eventAnnouncement", "radioAnnouncement", "wpImportedArticle"] &&
    (
      (_type in ["newsArticle", "eventAnnouncement", "radioAnnouncement"] && defined(slug.current)) ||
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
    _type in ["newsArticle", "eventAnnouncement", "radioAnnouncement", "wpImportedArticle"] &&
    (
      (_type in ["newsArticle", "eventAnnouncement", "radioAnnouncement"] && defined(slug.current)) ||
      (_type == "wpImportedArticle" && defined(wpPostId))
    ) &&
    !(_id in path("drafts.**")) &&
    !defined(*[_id == ("drafts." + ^._id)][0]._id) &&
    (!defined($categorySlug) || count((categories[]->slug.current)[@ == $categorySlug]) > 0) &&
    (!defined($tagSlug) || count((tags[]->slug.current)[@ == $tagSlug]) > 0)
  ])
`;

const bySlugQuery = groq`
  *[_type in ["newsArticle", "eventAnnouncement", "radioAnnouncement"] && slug.current == $slug][0]{
    _type,
    _id,
    title,
    slug,
    publishedAt,
    excerpt,
    body,
    "galleryImages": galleryImages[]{
      "url": asset->url,
      alt,
      caption
    },
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
    },
    eventDate,
    eventEndDate,
    eventTitle,
    broadcastDate,
    eventTimeText,
    personality,
    eventPrice,
    officialSiteUrl,
    organizer,
    "representativePerformers": representativePerformers[]{
      name,
      "group": group{
        groupNameJa,
        imdGroupId
      }
    },
    externalPerformers,
    ticketSalesUrl,
    streamingUrl,
    archiveUrl,
    afterTalkUrl,
    streamingDeadline,
    streamingPrice,
    "citationSourceArticle": citationSourceArticle->{
      _type,
      _id,
      title,
      slug,
      wpPostId,
      publishedAt,
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
      }
    },
    "citedByArticles": *[
      _type in ["newsArticle", "eventAnnouncement", "radioAnnouncement", "wpImportedArticle"] &&
      references(^._id) &&
      _id != ^._id &&
      !(_id in path("drafts.**")) &&
      !defined(*[_id == ("drafts." + ^._id)][0]._id)
    ] | order(publishedAt desc){
      _type,
      _id,
      title,
      slug,
      wpPostId,
      publishedAt,
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
      }
    }
  }
`;

const relatedEventsForHomeQuery = groq`
  *[
    _type == "eventAnnouncement" &&
    isMyRelatedEvent == true &&
    defined(slug.current) &&
    (
      (defined(eventDate) && eventDate >= $today) ||
      (defined(eventEndDate) && eventEndDate >= $today) ||
      (
        defined(streamingUrl) &&
        defined(streamingDeadline) &&
        streamingDeadline >= $today
      )
    ) &&
    !(_id in path("drafts.**")) &&
    !defined(*[_id == ("drafts." + ^._id)][0]._id)
  ]
  | order(eventDate asc, publishedAt desc)[0...$limit]{
    _id,
    title,
    slug,
    eventDate,
    eventEndDate,
    eventTimeText,
    streamingUrl,
    streamingDeadline,
    ticketSalesUrl,
    "heroImageUrl": heroImage.asset->url
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
    },
    "citationSourceArticle": citationSourceArticle->{
      _type,
      _id,
      title,
      slug,
      wpPostId,
      publishedAt,
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
      }
    },
    "citedByArticles": *[
      _type in ["newsArticle", "eventAnnouncement", "radioAnnouncement", "wpImportedArticle"] &&
      references(^._id) &&
      _id != ^._id &&
      !(_id in path("drafts.**")) &&
      !defined(*[_id == ("drafts." + ^._id)][0]._id)
    ] | order(publishedAt desc){
      _type,
      _id,
      title,
      slug,
      wpPostId,
      publishedAt,
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
      }
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

function toNewsPath(doc: SanityRelatedArticleDoc): string | null {
  if (doc._type === "wpImportedArticle") {
    if (!Number.isFinite(doc.wpPostId)) return null;
    return `/news/wp/${Number(doc.wpPostId)}`;
  }

  const slug = doc.slug?.current?.trim();
  if (!slug) return null;
  return `/news/${slug}`;
}

function mapRelatedArticle(doc: SanityRelatedArticleDoc | null | undefined): NewsRelatedArticleRef | null {
  if (!doc?._id) return null;
  const path = toNewsPath(doc);
  if (!path) return null;
  return {
    title: (doc.title ?? "").trim() || "(untitled)",
    path,
    publishedAt: doc.publishedAt ?? null,
    featuredImageUrl: doc.heroImageUrl ?? null,
    categories: mapRefTags(doc.categories),
    tags: mapRefTags(doc.tags),
  };
}

function mapRelatedArticles(items: SanityRelatedArticleDoc[] | null | undefined): NewsRelatedArticleRef[] {
  return (items ?? []).map(mapRelatedArticle).filter((item): item is NewsRelatedArticleRef => Boolean(item));
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
    _type?: "newsArticle" | "eventAnnouncement" | "radioAnnouncement";
    _id: string;
    title?: string | null;
    slug?: {current?: string | null} | null;
    publishedAt?: string | null;
    excerpt?: string | null;
    body?: unknown;
    galleryImages?:
      | Array<{
          url?: string | null;
          alt?: string | null;
          caption?: string | null;
        }>
      | null;
    heroImageUrl?: string | null;
    categories?: SanityRefTag[] | null;
    tags?: SanityRefTag[] | null;
    relatedGroups?: SanityRelatedGroup[] | null;
    eventDate?: string | null;
    eventEndDate?: string | null;
    eventTitle?: string | null;
    broadcastDate?: string | null;
    eventTimeText?: string | null;
    personality?: string | null;
    eventPrice?: string | null;
    officialSiteUrl?: string | null;
    organizer?: string | null;
    representativePerformers?:
      | Array<{
          name?: string | null;
          group?: {
            groupNameJa?: string | null;
            imdGroupId?: string | null;
          } | null;
        }>
      | null;
    externalPerformers?: string[] | null;
    ticketSalesUrl?: string | null;
    streamingUrl?: string | null;
    archiveUrl?: string | null;
    afterTalkUrl?: string | null;
    streamingDeadline?: string | null;
    streamingPrice?: string | null;
    citationSourceArticle?: SanityRelatedArticleDoc | null;
    citedByArticles?: SanityRelatedArticleDoc[] | null;
  } | null>(bySlugQuery, {slug: trimmed});

  if (!doc) return null;

  const currentSlug = doc.slug?.current?.trim();
  if (!currentSlug) return null;
  const title = (doc.title ?? "").trim() || "(untitled)";

  return {
    type:
      doc._type === "eventAnnouncement"
        ? "eventAnnouncement"
        : doc._type === "radioAnnouncement"
          ? "radioAnnouncement"
          : "newsArticle",
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
    galleryImages: (doc.galleryImages ?? [])
      .map((item) => ({
        url: typeof item?.url === "string" ? item.url.trim() : "",
        alt: typeof item?.alt === "string" && item.alt.trim().length > 0 ? item.alt.trim() : null,
        caption: typeof item?.caption === "string" && item.caption.trim().length > 0 ? item.caption.trim() : null,
      }))
      .filter((item) => item.url.length > 0),
    relatedGroups: (doc.relatedGroups ?? []).filter(
      (item): item is SanityRelatedGroup => Boolean(item?.groupNameJa)
    ),
    eventInfo:
      doc._type === "eventAnnouncement" || doc._type === "radioAnnouncement"
        ? {
            eventDate: doc.eventDate ?? null,
            eventEndDate: doc.eventEndDate ?? null,
            eventTitle:
              typeof doc.eventTitle === "string" && doc.eventTitle.trim().length > 0
                ? doc.eventTitle.trim()
                : null,
            broadcastDate: doc.broadcastDate ?? null,
            eventTimeText: doc.eventTimeText ?? null,
            personality:
              typeof doc.personality === "string" && doc.personality.trim().length > 0
                ? doc.personality.trim()
                : null,
            eventPrice:
              typeof doc.eventPrice === "string" && doc.eventPrice.trim().length > 0 ? doc.eventPrice.trim() : null,
            officialSiteUrl:
              typeof doc.officialSiteUrl === "string" && doc.officialSiteUrl.trim().length > 0
                ? doc.officialSiteUrl.trim()
                : null,
            organizer:
              typeof doc.organizer === "string" && doc.organizer.trim().length > 0 ? doc.organizer.trim() : null,
            representativePerformers: (doc.representativePerformers ?? [])
              .map((item) => ({
                name: typeof item?.name === "string" ? item.name.trim() : "",
                groupNameJa:
                  typeof item?.group?.groupNameJa === "string" && item.group.groupNameJa.trim().length > 0
                    ? item.group.groupNameJa.trim()
                    : null,
                imdGroupId:
                  typeof item?.group?.imdGroupId === "string" && item.group.imdGroupId.trim().length > 0
                    ? item.group.imdGroupId.trim()
                    : null,
              }))
              .filter((item) => item.name.length > 0),
            legacyExternalPerformers: (doc.externalPerformers ?? []).filter(
              (item): item is string => typeof item === "string" && item.trim().length > 0
            ),
            ticketSalesUrl:
              typeof doc.ticketSalesUrl === "string" && doc.ticketSalesUrl.trim().length > 0
                ? doc.ticketSalesUrl.trim()
                : null,
            streamingUrl:
              typeof doc.streamingUrl === "string" && doc.streamingUrl.trim().length > 0
                ? doc.streamingUrl.trim()
                : null,
            archiveUrl:
              typeof doc.archiveUrl === "string" && doc.archiveUrl.trim().length > 0 ? doc.archiveUrl.trim() : null,
            afterTalkUrl:
              typeof doc.afterTalkUrl === "string" && doc.afterTalkUrl.trim().length > 0
                ? doc.afterTalkUrl.trim()
                : null,
            streamingDeadline:
              typeof doc.streamingDeadline === "string" && doc.streamingDeadline.trim().length > 0
                ? doc.streamingDeadline.trim()
                : null,
            streamingPrice:
              typeof doc.streamingPrice === "string" && doc.streamingPrice.trim().length > 0
                ? doc.streamingPrice.trim()
                : null,
          }
        : null,
    citationSourceArticle: mapRelatedArticle(doc.citationSourceArticle),
    citedByArticles: mapRelatedArticles(doc.citedByArticles),
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
    citationSourceArticle?: SanityRelatedArticleDoc | null;
    citedByArticles?: SanityRelatedArticleDoc[] | null;
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
    citationSourceArticle: mapRelatedArticle(doc.citationSourceArticle),
    citedByArticles: mapRelatedArticles(doc.citedByArticles),
  };
}

export async function getSanityRelatedEventsForHome(limit = 3): Promise<HomeRelatedEvent[]> {
  if (!hasSanityStudioEnv()) return [];
  const safeLimit = Math.max(1, Math.min(20, Math.trunc(limit || 3)));
  const today = new Date().toISOString().slice(0, 10);

  const docs = await sanityClient.fetch<SanityRelatedEventHomeDoc[]>(relatedEventsForHomeQuery, {
    limit: safeLimit,
    today,
  });

  return docs
    .map((doc) => {
      const slug = doc.slug?.current?.trim();
      const eventDate = typeof doc.eventDate === "string" && doc.eventDate.trim() ? doc.eventDate.trim() : null;
      const eventEndDate = typeof doc.eventEndDate === "string" && doc.eventEndDate.trim() ? doc.eventEndDate.trim() : null;
      if (!slug) return null;
      return {
        id: doc._id,
        title: (doc.title ?? "").trim() || "(untitled)",
        path: `/news/${slug}`,
        eventDate,
        eventEndDate,
        eventTimeText: typeof doc.eventTimeText === "string" && doc.eventTimeText.trim() ? doc.eventTimeText.trim() : null,
        ticketSalesUrl:
          typeof doc.ticketSalesUrl === "string" && doc.ticketSalesUrl.trim() ? doc.ticketSalesUrl.trim() : null,
        streamingDeadline:
          typeof doc.streamingDeadline === "string" && doc.streamingDeadline.trim() ? doc.streamingDeadline.trim() : null,
        featuredImageUrl: doc.heroImageUrl ?? null,
      } satisfies HomeRelatedEvent;
    })
    .filter((item): item is HomeRelatedEvent => Boolean(item));
}
