import {defineConfig} from "sanity";
import {structureTool} from "sanity/structure";
import {schemaTypes} from "./src/sanity/schemaTypes";
import {deskStructure} from "./src/sanity/desk-structure";
import {getSanityConfigValues} from "./src/sanity/env";

const {projectId, dataset} = getSanityConfigValues();

export default defineConfig({
  name: "default",
  title: "musicite AI Studio",
  projectId,
  dataset,
  basePath: "/studio",
  plugins: [structureTool({structure: deskStructure})],
  schema: {
    types: schemaTypes,
  },
});
