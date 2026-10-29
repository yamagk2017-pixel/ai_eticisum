import {defineConfig} from "sanity";
import {structureTool} from "sanity/structure";
import {schemaTypes} from "./src/sanity/schemaTypes";
import {deskStructure} from "./src/sanity/desk-structure";
import {getSanityConfigValues} from "./src/sanity/env";
import {CopyPreviewShareLinkAction, OpenPreviewAction} from "./src/sanity/document-actions/copy-preview-share-link-action";
import "./src/sanity/studio.css";

const {projectId, dataset} = getSanityConfigValues();
export default defineConfig({
  name: "default",
  title: "[Studio] musicite AI Studio",
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
      return [OpenPreviewAction, CopyPreviewShareLinkAction, ...prev];
    },
    // Draft access must use the signed URL issued by the custom actions.
    productionUrl: async () => undefined,
  },
  schema: {
    types: schemaTypes,
  },
});
