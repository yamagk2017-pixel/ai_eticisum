export type PreviewDocumentLike = {
  _type?: string;
  slug?: {current?: string | null} | null;
  wpPostId?: number | string | null;
};

export function resolvePreviewPath(document: PreviewDocumentLike): string | undefined {
  const type = document._type;
  if (!type) return undefined;

  if (type === "newsArticle" || type === "eventAnnouncement" || type === "radioAnnouncement") {
    const slug = document.slug?.current?.trim();
    if (!slug) return undefined;
    return `/news/${slug}`;
  }

  if (type === "wpImportedArticle") {
    const idText = String(document.wpPostId ?? "").trim();
    if (!/^\d+$/.test(idText)) return undefined;
    return `/news/wp/${idText}`;
  }

  if (type === "newsCategory") {
    const slug = document.slug?.current?.trim();
    if (!slug) return undefined;
    return `/news?category=${encodeURIComponent(slug)}`;
  }

  if (type === "newsTag") {
    const slug = document.slug?.current?.trim();
    if (!slug) return undefined;
    return `/news?tag=${encodeURIComponent(slug)}`;
  }

  return undefined;
}

