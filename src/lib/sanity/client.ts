import {createClient} from "next-sanity";
import {getSanityConfigValues} from "@/sanity/env";

const {projectId, dataset, apiVersion} = getSanityConfigValues();

export const sanityClient = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: false,
});
