export type NewsTag = {
  id: number;
  name: string;
  slug: string | null;
};

export type NewsRelatedGroupRef = {
  groupNameJa: string;
  imdGroupId?: string | null;
  displayOrder?: number | null;
};

export type NewsRelatedArticleRef = {
  title: string;
  path: string;
  publishedAt: string | null;
  featuredImageUrl?: string | null;
  categories?: NewsTag[];
  tags?: NewsTag[];
};

export type NewsArticleSource = "wp" | "sanity" | "sanity_wp_import";

export type NewsRouteType = "wp-id" | "sanity-slug";

export type NewsArticle = {
  source: NewsArticleSource;
  routeType: NewsRouteType;
  path: string;
  id: number;
  slug: string;
  url: string | null;
  publishedAt: string | null;
  titleHtml: string;
  excerptHtml: string;
  contentHtml: string;
  featuredImageUrl: string | null;
  featuredImageAlt: string | null;
  categories: NewsTag[];
  tags: NewsTag[];
  relatedGroups?: NewsRelatedGroupRef[];
  citationSourceArticle?: NewsRelatedArticleRef | null;
  citedByArticles?: NewsRelatedArticleRef[];
};
