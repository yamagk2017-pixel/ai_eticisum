type WpRenderedField = {
  rendered?: string;
};

type WpFeaturedMedia = {
  source_url?: string;
  alt_text?: string;
};

type WpPostApiItem = {
  id: number;
  date?: string;
  slug?: string;
  link?: string;
  title?: WpRenderedField;
  excerpt?: WpRenderedField;
  content?: WpRenderedField;
  _embedded?: {
    "wp:featuredmedia"?: WpFeaturedMedia[];
  };
};

export type WpLatestPost = {
  id: number;
  slug: string;
  url: string | null;
  date: string | null;
  titleHtml: string;
  excerptHtml: string;
  contentHtml: string;
  featuredImageUrl: string | null;
  featuredImageAlt: string | null;
};

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, "");
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

export async function fetchLatestWpPost(): Promise<WpLatestPost | null> {
  const baseUrl = readString(process.env.WP_API_BASE_URL);
  if (!baseUrl) return null;

  const endpoint = `${normalizeBaseUrl(baseUrl)}/wp-json/wp/v2/posts?per_page=1&_embed`;
  const response = await fetch(endpoint, {
    headers: { Accept: "application/json" },
    next: { revalidate: 60 },
  });

  if (!response.ok) {
    throw new Error(`WP API request failed: ${response.status} ${response.statusText}`);
  }

  const json = (await response.json()) as unknown;
  if (!Array.isArray(json) || json.length === 0) return null;

  const post = json[0] as WpPostApiItem;
  const featuredMedia = post._embedded?.["wp:featuredmedia"]?.[0];

  return {
    id: post.id,
    slug: readString(post.slug) ?? String(post.id),
    url: readString(post.link),
    date: readString(post.date),
    titleHtml: readString(post.title?.rendered) ?? "(no title)",
    excerptHtml: readString(post.excerpt?.rendered) ?? "",
    contentHtml: readString(post.content?.rendered) ?? "",
    featuredImageUrl: readString(featuredMedia?.source_url),
    featuredImageAlt: readString(featuredMedia?.alt_text),
  };
}
