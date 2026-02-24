import imageUrlBuilder from "@sanity/image-url";
import {getSanityConfigValues} from "@/sanity/env";

const {projectId, dataset} = getSanityConfigValues();

const builder = imageUrlBuilder({projectId, dataset});

export function urlForSanityImage(source: unknown) {
  return builder.image(source);
}
