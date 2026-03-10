import {createImageUrlBuilder} from "@sanity/image-url";
import {getSanityConfigValues} from "@/sanity/env";

const {projectId, dataset} = getSanityConfigValues();

const builder = createImageUrlBuilder({projectId, dataset});
type SanityImageSource = Parameters<typeof builder.image>[0];

export function urlForSanityImage(source: SanityImageSource) {
  return builder.image(source);
}
