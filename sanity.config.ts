import {defineConfig} from "sanity";
import {structureTool} from "sanity/structure";
import {schemaTypes} from "./src/sanity/schemaTypes";
import {deskStructure} from "./src/sanity/desk-structure";
import {getSanityConfigValues} from "./src/sanity/env";
import "./src/sanity/studio.css";

const {projectId, dataset} = getSanityConfigValues();
const previewOrigin =
  typeof process.env.SANITY_STUDIO_PREVIEW_ORIGIN === "string" &&
  process.env.SANITY_STUDIO_PREVIEW_ORIGIN.trim().length > 0
    ? process.env.SANITY_STUDIO_PREVIEW_ORIGIN.trim().replace(/\/$/, "")
    : "https://www.musicite.net";

type PreviewDocument = {
  _type?: string;
  slug?: {current?: string | null} | null;
  wpPostId?: number | string | null;
};

function resolvePreviewPath(document: PreviewDocument): string | undefined {
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

export default defineConfig({
  name: "default",
  title: "musicite AI Studio",
  projectId,
  dataset,
  basePath: "/studio",
  plugins: [structureTool({structure: deskStructure})],
  document: {
    productionUrl: async (_prev, context) => {
      const path = resolvePreviewPath((context.document ?? {}) as PreviewDocument);
      if (!path) return undefined;
      const query = new URLSearchParams({path}).toString();
      return `${previewOrigin}/api/draft/enable?${query}`;
    },
  },
  schema: {
    types: schemaTypes,
  },
});
