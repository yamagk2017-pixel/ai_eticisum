import {defineCliConfig} from "sanity/cli";
import {getSanityConfigValues} from "./src/sanity/env";

const {projectId, dataset} = getSanityConfigValues();

export default defineCliConfig({
  api: {
    projectId,
    dataset,
  },
});
