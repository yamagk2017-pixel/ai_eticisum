type WpRenderedField = {
  rendered?: string;
};

type WpFeaturedMedia = {
  source_url?: string;
  alt_text?: string;
};

type WpTermApiItem = {
  id?: number;
  taxonomy?: string;
  name?: string;
  slug?: string;
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
    "wp:term"?: WpTermApiItem[][];
  };
};

export type WpTerm = {
  id: number;
  name: string;
  slug: string | null;
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
  categories: WpTerm[];
  tags: WpTerm[];
};

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, "");
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function sanitizeWpHtml(html: string): string {
  return html
    .replace(/style=(['"])(.*?)\1/gi, (_full, quote: string, styleValue: string) => {
      const kept = styleValue
        .split(";")
        .map((part) => part.trim())
        .filter(Boolean)
        .filter((part) => !/^(color|background-color)\s*:/i.test(part));

      if (kept.length === 0) return "";
      return `style=${quote}${kept.join("; ")}${quote}`;
    })
    .replace(/\scolor=(['"]).*?\1/gi, "");
}

function extractTerms(post: WpPostApiItem, taxonomy: "category" | "post_tag"): WpTerm[] {
  const groups = post._embedded?.["wp:term"] ?? [];
  const seen = new Set<number>();
  const terms: WpTerm[] = [];

  for (const group of groups) {
    for (const item of group) {
      if (item.taxonomy !== taxonomy) continue;

      const id = readNumber(item.id);
      const name = readString(item.name);
      if (id === null || !name) continue;
      if (seen.has(id)) continue;

      seen.add(id);
      terms.push({
        id,
        name,
        slug: readString(item.slug),
      });
    }
  }

  return terms;
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
    excerptHtml: sanitizeWpHtml(readString(post.excerpt?.rendered) ?? ""),
    contentHtml: sanitizeWpHtml(readString(post.content?.rendered) ?? ""),
    featuredImageUrl: readString(featuredMedia?.source_url),
    featuredImageAlt: readString(featuredMedia?.alt_text),
    categories: extractTerms(post, "category"),
    tags: extractTerms(post, "post_tag"),
  };
}
