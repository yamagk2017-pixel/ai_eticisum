import sanitizeHtml from "sanitize-html";

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
  date_gmt?: string;
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

export type WpPost = WpLatestPost;
export type WpPostsPageResult = {
  posts: WpPost[];
  total: number;
  totalPages: number;
};

export type WpClientErrorKind = "config" | "timeout" | "http" | "network";

export class WpClientError extends Error {
  kind: WpClientErrorKind;
  endpoint?: string;
  status?: number;

  constructor(
    message: string,
    options: { kind: WpClientErrorKind; endpoint?: string; status?: number }
  ) {
    super(message);
    this.name = "WpClientError";
    this.kind = options.kind;
    this.endpoint = options.endpoint;
    this.status = options.status;
  }
}

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, "");
}

function getWpBaseUrlOrNull() {
  return readString(process.env.WP_API_BASE_URL);
}

function getWpImageCdnBaseUrlOrNull() {
  return readString(process.env.WP_IMAGE_CDN_BASE_URL);
}

export function hasWpApiBaseUrlConfigured() {
  return Boolean(getWpBaseUrlOrNull());
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toUtcIsoString(value: string, assumeTimeZone: "UTC" | "Asia/Tokyo"): string | null {
  const hasExplicitZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value);
  const normalized = hasExplicitZone
    ? value
    : assumeTimeZone === "UTC"
      ? `${value}Z`
      : `${value}+09:00`;
  const time = Date.parse(normalized);
  return Number.isNaN(time) ? null : new Date(time).toISOString();
}

function readWpPublishedAt(post: WpPostApiItem): string | null {
  const gmt = readString(post.date_gmt);
  if (gmt) {
    const normalized = toUtcIsoString(gmt, "UTC");
    if (normalized) return normalized;
  }

  const local = readString(post.date);
  return local ? toUtcIsoString(local, "Asia/Tokyo") : null;
}

const WP_ALLOWED_TAGS = [
  ...sanitizeHtml.defaults.allowedTags,
  "div",
  "span",
  "figure",
  "figcaption",
  "img",
  "picture",
  "source",
  "video",
  "audio",
] as const;

const WP_ALLOWED_ATTRIBUTES: sanitizeHtml.IOptions["allowedAttributes"] = {
  "*": ["class", "title", "aria-label", "aria-hidden", "role"],
  a: ["href", "name"],
  img: ["src", "srcset", "sizes", "alt", "width", "height", "loading", "decoding", "data-src", "data-src-fg"],
  source: ["src", "srcset", "sizes", "type", "media"],
  video: ["src", "poster", "controls", "preload", "width", "height"],
  audio: ["src", "controls", "preload"],
  td: ["colspan", "rowspan", "headers"],
  th: ["colspan", "rowspan", "scope", "headers"],
};

export function sanitizeWpHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [...WP_ALLOWED_TAGS],
    allowedAttributes: WP_ALLOWED_ATTRIBUTES,
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesByTag: {
      img: ["http", "https", "data"],
      source: ["http", "https"],
      video: ["http", "https"],
      audio: ["http", "https"],
    },
    allowProtocolRelative: false,
    disallowedTagsMode: "discard",
    nonTextTags: ["style", "script", "textarea", "option", "noscript"],
  });
}

export function sanitizeWpTitleHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [],
    allowedAttributes: {},
    disallowedTagsMode: "discard",
    nonTextTags: ["style", "script", "textarea", "option", "noscript"],
  });
}

function rewriteWpImageUrl(url: string | null): string | null {
  if (!url) return null;

  try {
    const original = new URL(url);
    const isWpUploads =
      original.hostname === "musicite.sub.jp" && original.pathname.startsWith("/inm/wp-content/uploads/");
    if (!isWpUploads) return url;

    const cdnBaseUrl = getWpImageCdnBaseUrlOrNull();
    if (!cdnBaseUrl) {
      if (original.protocol === "http:") {
        original.protocol = "https:";
        return original.toString();
      }
      return url;
    }

    const cdn = new URL(cdnBaseUrl);
    const cdnPathPrefix = cdn.pathname.replace(/\/+$/, "");
    cdn.pathname = `${cdnPathPrefix}${original.pathname}`;
    cdn.search = original.search;
    return cdn.toString();
  } catch {
    return url;
  }
}

function rewriteWpImageUrlsInHtml(html: string): string {
  return html.replace(
    /https?:\/\/musicite\.sub\.jp\/inm\/wp-content\/uploads\/[^\s"'()<>]+/gi,
    (rawUrl) => rewriteWpImageUrl(rawUrl) ?? rawUrl
  );
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

function mapWpPost(post: WpPostApiItem): WpPost {
  const featuredMedia = post._embedded?.["wp:featuredmedia"]?.[0];

  return {
    id: post.id,
    slug: readString(post.slug) ?? String(post.id),
    url: readString(post.link),
    date: readWpPublishedAt(post),
    titleHtml: sanitizeWpTitleHtml(readString(post.title?.rendered) ?? "(no title)"),
    excerptHtml: rewriteWpImageUrlsInHtml(sanitizeWpHtml(readString(post.excerpt?.rendered) ?? "")),
    contentHtml: rewriteWpImageUrlsInHtml(sanitizeWpHtml(readString(post.content?.rendered) ?? "")),
    featuredImageUrl: rewriteWpImageUrl(readString(featuredMedia?.source_url)),
    featuredImageAlt: readString(featuredMedia?.alt_text),
    categories: extractTerms(post, "category"),
    tags: extractTerms(post, "post_tag"),
  };
}

async function fetchWpPostsFromEndpoint(endpoint: string): Promise<WpPost[]> {
  const controller = new AbortController();
  const timeoutMs = 8000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(endpoint, {
      headers: { Accept: "application/json" },
      next: { revalidate: 60 },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new WpClientError(`WP API request failed: ${response.status} ${response.statusText}`, {
        kind: "http",
        endpoint,
        status: response.status,
      });
    }

    const json = (await response.json()) as unknown;
    if (!Array.isArray(json)) return [];

    return json.map((item) => mapWpPost(item as WpPostApiItem));
  } catch (error) {
    if (error instanceof WpClientError) {
      console.error("[wp-client]", error.kind, { endpoint: error.endpoint, status: error.status });
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      const wrapped = new WpClientError(`WP API request timed out after ${timeoutMs}ms`, {
        kind: "timeout",
        endpoint,
      });
      console.error("[wp-client]", wrapped.kind, { endpoint: wrapped.endpoint });
      throw wrapped;
    }

    const wrapped = new WpClientError("WP API network error", { kind: "network", endpoint });
    console.error("[wp-client]", wrapped.kind, { endpoint: wrapped.endpoint, cause: error });
    throw wrapped;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchWpPostsPageFromEndpoint(endpoint: string): Promise<WpPostsPageResult> {
  const controller = new AbortController();
  const timeoutMs = 8000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(endpoint, {
      headers: {Accept: "application/json"},
      next: {revalidate: 60},
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new WpClientError(`WP API request failed: ${response.status} ${response.statusText}`, {
        kind: "http",
        endpoint,
        status: response.status,
      });
    }

    const json = (await response.json()) as unknown;
    const posts = Array.isArray(json) ? json.map((item) => mapWpPost(item as WpPostApiItem)) : [];
    const total = Number(response.headers.get("x-wp-total") ?? 0);
    const totalPages = Number(response.headers.get("x-wp-totalpages") ?? 0);

    return {
      posts,
      total: Number.isFinite(total) ? total : 0,
      totalPages: Number.isFinite(totalPages) ? totalPages : 0,
    };
  } catch (error) {
    if (error instanceof WpClientError) {
      console.error("[wp-client]", error.kind, {endpoint: error.endpoint, status: error.status});
      throw error;
    }
    if (error instanceof Error && error.name === "AbortError") {
      const wrapped = new WpClientError(`WP API request timed out after ${timeoutMs}ms`, {
        kind: "timeout",
        endpoint,
      });
      console.error("[wp-client]", wrapped.kind, {endpoint: wrapped.endpoint});
      throw wrapped;
    }
    const wrapped = new WpClientError("WP API network error", {kind: "network", endpoint});
    console.error("[wp-client]", wrapped.kind, {endpoint: wrapped.endpoint, cause: error});
    throw wrapped;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function fetchLatestWpPost(): Promise<WpLatestPost | null> {
  const baseUrl = getWpBaseUrlOrNull();
  if (!baseUrl) return null;

  const endpoint = `${normalizeBaseUrl(baseUrl)}/wp-json/wp/v2/posts?per_page=1&_embed`;
  const posts = await fetchWpPostsFromEndpoint(endpoint);
  return posts[0] ?? null;
}

export async function fetchWpPostById(postId: number): Promise<WpPost | null> {
  const baseUrl = getWpBaseUrlOrNull();
  if (!baseUrl) return null;

  const endpoint = `${normalizeBaseUrl(baseUrl)}/wp-json/wp/v2/posts?include=${encodeURIComponent(String(postId))}&_embed`;
  const posts = await fetchWpPostsFromEndpoint(endpoint);
  return posts[0] ?? null;
}

export async function fetchWpPostBySlug(slug: string): Promise<WpPost | null> {
  const baseUrl = getWpBaseUrlOrNull();
  if (!baseUrl) return null;

  const endpoint = `${normalizeBaseUrl(baseUrl)}/wp-json/wp/v2/posts?slug=${encodeURIComponent(slug)}&_embed`;
  const posts = await fetchWpPostsFromEndpoint(endpoint);
  return posts[0] ?? null;
}

export async function fetchWpPostsList(
  limit = 10,
  options?: { categoryId?: number; tagId?: number }
): Promise<WpPost[]> {
  const result = await fetchWpPostsListPage(limit, 1, options);
  return result.posts;
}

export async function fetchWpPostsListPage(
  limit = 10,
  page = 1,
  options?: { categoryId?: number; tagId?: number }
): Promise<WpPostsPageResult> {
  const baseUrl = getWpBaseUrlOrNull();
  if (!baseUrl) return {posts: [], total: 0, totalPages: 0};

  const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(Math.trunc(limit), 1), 100) : 10;
  const safePage = Number.isFinite(page) ? Math.max(Math.trunc(page), 1) : 1;
  const params = new URLSearchParams({
    per_page: String(safeLimit),
    page: String(safePage),
    _embed: "",
  });
  if (options?.categoryId) params.set("categories", String(options.categoryId));
  if (options?.tagId) params.set("tags", String(options.tagId));

  const endpoint = `${normalizeBaseUrl(baseUrl)}/wp-json/wp/v2/posts?${params.toString()}`;
  return fetchWpPostsPageFromEndpoint(endpoint);
}

export async function fetchWpTermIdBySlug(
  taxonomy: "categories" | "tags",
  slug: string
): Promise<number | null> {
  const baseUrl = getWpBaseUrlOrNull();
  if (!baseUrl) return null;
  const trimmed = slug.trim();
  if (!trimmed) return null;

  const endpoint = `${normalizeBaseUrl(baseUrl)}/wp-json/wp/v2/${taxonomy}?slug=${encodeURIComponent(trimmed)}&per_page=1`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(endpoint, {
      headers: {Accept: "application/json"},
      next: {revalidate: 300},
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new WpClientError(`WP taxonomy request failed: ${response.status}`, {
        kind: "http", endpoint, status: response.status,
      });
    }
    const json = (await response.json()) as Array<{id?: number}> | unknown;
    if (!Array.isArray(json)) throw new WpClientError("Invalid WP taxonomy response", {kind: "network", endpoint});
    const id = json[0]?.id;
    return typeof id === "number" && Number.isFinite(id) ? id : null;
  } catch (error) {
    if (error instanceof WpClientError) throw error;
    throw new WpClientError("WP taxonomy request failed", {
      kind: error instanceof Error && error.name === "AbortError" ? "timeout" : "network", endpoint,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

// Archive ordering only needs IDs and dates; avoid embedding media and full bodies
// for thousands of posts. Each request stays within WordPress's 100-post limit.
export async function fetchWpPostIndexPage(
  page: number,
  options?: {categoryId?: number; tagId?: number}
): Promise<{items: Array<{id: number; publishedAt: string | null}>; totalPages: number}> {
  const baseUrl = getWpBaseUrlOrNull();
  if (!baseUrl) return {items: [], totalPages: 0};
  const params = new URLSearchParams({
    per_page: "100", page: String(page), _fields: "id,date,date_gmt", orderby: "date", order: "desc",
  });
  if (options?.categoryId) params.set("categories", String(options.categoryId));
  if (options?.tagId) params.set("tags", String(options.tagId));
  const endpoint = `${normalizeBaseUrl(baseUrl)}/wp-json/wp/v2/posts?${params}`;
  const result = await fetchWpArchivePageWithRetry(endpoint);
  return {
    items: result.posts.map((post) => ({id: post.id, publishedAt: post.date})),
    totalPages: result.totalPages,
  };
}

export async function fetchWpArchivePostsByIds(ids: number[]): Promise<WpPost[]> {
  const baseUrl = getWpBaseUrlOrNull();
  if (!baseUrl || ids.length === 0) return [];
  if (ids.length > 100) throw new Error("Archive detail requests must contain at most 100 IDs");
  const params = new URLSearchParams({
    include: ids.join(","), per_page: String(ids.length), _embed: "",
    _fields: "id,date,date_gmt,slug,link,title,excerpt,_links,_embedded",
  });
  const result = await fetchWpArchivePageWithRetry(`${normalizeBaseUrl(baseUrl)}/wp-json/wp/v2/posts?${params}`);
  return result.posts;
}

async function fetchWpArchivePageWithRetry(endpoint: string): Promise<WpPostsPageResult> {
  try {
    return await fetchWpPostsPageFromEndpoint(endpoint);
  } catch (error) {
    if (!(error instanceof WpClientError) || (error.kind === "http" && (error.status ?? 0) < 500)) throw error;
    return fetchWpPostsPageFromEndpoint(endpoint);
  }
}
