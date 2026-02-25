import imageUrlBuilder from "@sanity/image-url";
import type {SanityImageSource} from "@sanity/image-url/lib/types/types";
import {getSanityConfigValues} from "@/sanity/env";

const {projectId, dataset} = getSanityConfigValues();

const builder = imageUrlBuilder({projectId, dataset});

export function urlForSanityImage(source: SanityImageSource) {
  return builder.image(source);
}
