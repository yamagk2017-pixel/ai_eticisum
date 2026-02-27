import {createClient} from "next-sanity";
import {getSanityConfigValues} from "@/sanity/env";

const {projectId, dataset, apiVersion} = getSanityConfigValues();
const serverToken =
  process.env.SANITY_API_READ_TOKEN ||
  process.env.SANITY_API_WRITE_TOKEN ||
  process.env.SANITY_API_TOKEN;

export const sanityClient = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: false,
  token: serverToken || undefined,
});
