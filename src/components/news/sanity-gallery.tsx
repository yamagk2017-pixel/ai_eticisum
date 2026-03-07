"use client";

import {useState} from "react";

type GalleryImage = {
  url: string;
  alt: string | null;
  caption: string | null;
};

export function SanityGallery({images}: {images: GalleryImage[]}) {
  const [activeImage, setActiveImage] = useState<GalleryImage | null>(null);
  const [modalImageError, setModalImageError] = useState(false);

  const normalizeImageUrl = (url: string) => {
    if (url.startsWith("http://musicite.sub.jp/")) return url.replace("http://", "https://");
    if (url.startsWith("http://cdn.sanity.io/")) return url.replace("http://", "https://");
    return url;
  };

  const activeImageUrl = activeImage ? normalizeImageUrl(activeImage.url) : null;

  return (
    <>
      <section className="mt-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {images.map((image, index) => (
            <figure key={`gallery-${index}`} className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  setModalImageError(false);
                  setActiveImage(image);
                }}
                className="block w-full text-left"
                aria-label={`Open image ${index + 1}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={normalizeImageUrl(image.url)}
                  alt={image.alt ?? ""}
                  className="h-auto w-full rounded-xl border border-[var(--ui-border)] object-cover"
                />
              </button>
              {image.caption ? <figcaption className="text-xs text-[var(--ui-text-subtle)]">{image.caption}</figcaption> : null}
            </figure>
          ))}
        </div>
      </section>

      {activeImage ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
          onClick={() => setActiveImage(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="relative max-h-[92vh] max-w-[92vw] overflow-auto rounded-xl border border-[var(--ui-border)] bg-[var(--ui-panel)] p-0 text-[var(--ui-text)]"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setActiveImage(null)}
              className="absolute right-2 top-2 z-10 rounded-full bg-black/70 px-3 py-1 text-sm text-white"
              aria-label="Close image modal"
            >
              Close
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {!modalImageError ? (
              <img
                src={activeImageUrl ?? ""}
                alt={activeImage.alt ?? ""}
                className="block max-h-[90vh] max-w-[92vw] object-contain"
                onError={() => setModalImageError(true)}
              />
            ) : (
              <div className="min-w-[320px] max-w-[92vw] px-4 py-16 text-center">
                <p className="text-sm text-rose-500">画像を読み込めませんでした。</p>
                {activeImageUrl ? (
                  <a
                    href={activeImageUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 block break-all text-xs underline underline-offset-2 text-[var(--ui-link)]"
                  >
                    {activeImageUrl}
                  </a>
                ) : null}
              </div>
            )}
            {activeImage.caption ? <p className="px-4 py-3 text-xs text-[var(--ui-text-subtle)]">{activeImage.caption}</p> : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
