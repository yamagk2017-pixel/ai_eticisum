import {defineConfig} from "sanity";
import {structureTool} from "sanity/structure";
import {schemaTypes} from "./src/sanity/schemaTypes";
import {deskStructure} from "./src/sanity/desk-structure";
import {getSanityConfigValues} from "./src/sanity/env";
import {resolvePreviewPath, type PreviewDocumentLike} from "./src/sanity/preview-path";
import {CopyPreviewShareLinkAction} from "./src/sanity/document-actions/copy-preview-share-link-action";
import "./src/sanity/studio.css";

const {projectId, dataset} = getSanityConfigValues();
const previewOrigin =
  typeof process.env.SANITY_STUDIO_PREVIEW_ORIGIN === "string" &&
  process.env.SANITY_STUDIO_PREVIEW_ORIGIN.trim().length > 0
    ? process.env.SANITY_STUDIO_PREVIEW_ORIGIN.trim().replace(/\/$/, "")
    : "https://www.musicite.net";

export default defineConfig({
  name: "default",
  title: "musicite AI Studio",
  projectId,
  dataset,
  basePath: "/studio",
  plugins: [structureTool({structure: deskStructure})],
  document: {
    actions: (prev, context) => {
      const type = context.schemaType;
      const supported =
        type === "newsArticle" ||
        type === "eventAnnouncement" ||
        type === "radioAnnouncement" ||
        type === "wpImportedArticle" ||
        type === "newsCategory" ||
        type === "newsTag";
      if (!supported) return prev;
      return [CopyPreviewShareLinkAction, ...prev];
    },
    productionUrl: async (_prev, context) => {
      const path = resolvePreviewPath((context.document ?? {}) as PreviewDocumentLike);
      if (!path) return undefined;
      const query = new URLSearchParams({path}).toString();
      return `${previewOrigin}/api/draft/enable?${query}`;
    },
  },
  schema: {
    types: schemaTypes,
  },
});
