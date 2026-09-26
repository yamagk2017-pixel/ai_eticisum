import {getPublishedId, type SlugIsUniqueValidator} from "sanity";

const newsDocumentTypes = ["newsArticle", "eventAnnouncement", "radioAnnouncement"];

export const isUniqueAcrossNewsDocuments: SlugIsUniqueValidator = async (slug, context) => {
  const documentId = context.document?._id;
  if (!documentId || !slug) return true;

  const publishedId = getPublishedId(documentId);
  const client = context.getClient({apiVersion: "2026-02-24"});
  return client.fetch<boolean>(
    `!defined(*[
      _type in $types &&
      !sanity::versionOf($publishedId) &&
      slug.current == $slug
    ][0]._id)`,
    {
      types: newsDocumentTypes,
      publishedId,
      slug,
    }
  );
};
