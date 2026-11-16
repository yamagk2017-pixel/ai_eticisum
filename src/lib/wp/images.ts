const WP_UPLOADS_PATH = "/inm/wp-content/uploads/";
const WP_IMAGE_HOSTS = new Set(["www.musicite.net", "musicite.net", "musicite.sub.jp"]);

/** Resolve legacy upload URLs before passing them to Next.js image optimization. */
export function rewriteWpImageUrl(url: string | null): string | null {
  if (!url) return null;

  try {
    const original = new URL(url);
    if (
      !["http:", "https:"].includes(original.protocol) ||
      !WP_IMAGE_HOSTS.has(original.hostname) ||
      !original.pathname.startsWith(WP_UPLOADS_PATH)
    ) return url;

    const cdnBaseUrl = process.env.WP_IMAGE_CDN_BASE_URL?.trim();
    if (cdnBaseUrl) {
      const cdn = new URL(cdnBaseUrl);
      const cdnPathPrefix = cdn.pathname.replace(/\/+$/, "");
      cdn.pathname = `${cdnPathPrefix}${original.pathname}`;
      cdn.search = original.search;
      cdn.hash = original.hash;
      return cdn.toString();
    }

    original.protocol = "https:";
    original.hostname = "musicite.sub.jp";
    return original.toString();
  } catch {
    return url;
  }
}

export function rewriteWpImageUrlsInHtml(html: string): string {
  return html.replace(
    /https?:\/\/(?:www\.musicite\.net|musicite\.net|musicite\.sub\.jp)\/inm\/wp-content\/uploads\/[^\s"'()<>]+/gi,
    (rawUrl) => rewriteWpImageUrl(rawUrl) ?? rawUrl
  );
}
