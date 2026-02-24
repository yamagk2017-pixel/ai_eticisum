export type NewsTag = {
  id: number;
  name: string;
  slug: string | null;
};

export type NewsArticle = {
  source: "wp";
  id: number;
  slug: string;
  url: string | null;
  date: string | null;
  titleHtml: string;
  excerptHtml: string;
  contentHtml: string;
  featuredImageUrl: string | null;
  featuredImageAlt: string | null;
  categories: NewsTag[];
  tags: NewsTag[];
};

