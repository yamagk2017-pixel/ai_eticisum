"use client";

import {useState} from "react";

type GalleryImage = {
  url: string;
  alt: string | null;
  caption: string | null;
};

export function SanityGallery({images}: {images: GalleryImage[]}) {
  const [activeImage, setActiveImage] = useState<GalleryImage | null>(null);
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [modalImageError, setModalImageError] = useState(false);

  const normalizeImageUrl = (url: string) => {
    const normalized = url.trim();
    if (normalized.startsWith("http://musicite.sub.jp/")) return normalized.replace("http://", "https://");
    if (normalized.startsWith("http://cdn.sanity.io/")) return normalized.replace("http://", "https://");
    return normalized;
  };

  const isValidHttpUrl = (url: string) => /^https?:\/\//i.test(url);
  const activeImageUrl = activeImage ? normalizeImageUrl(activeImage.url) : null;
  const hasPagination = images.length > 1;

  const goPrev = () => {
    if (!activeImage || !hasPagination) return;
    const nextIndex = activeIndex <= 0 ? images.length - 1 : activeIndex - 1;
    setActiveIndex(nextIndex);
    setActiveImage(images[nextIndex] ?? null);
    setModalImageError(false);
  };

  const goNext = () => {
    if (!activeImage || !hasPagination) return;
    const nextIndex = activeIndex >= images.length - 1 ? 0 : activeIndex + 1;
    setActiveIndex(nextIndex);
    setActiveImage(images[nextIndex] ?? null);
    setModalImageError(false);
  };

  return (
    <>
      <section className="mt-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {images.map((image, index) => (
            <figure key={`gallery-${index}`} className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  const normalized = normalizeImageUrl(image.url);
                  setModalImageError(!isValidHttpUrl(normalized));
                  setActiveIndex(index);
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
            className="relative min-h-[220px] w-[92vw] max-w-[1200px] max-h-[92vh] overflow-auto rounded-xl border border-[var(--ui-border)] bg-[var(--ui-panel)] p-0 text-[var(--ui-text)]"
            onClick={(event) => event.stopPropagation()}
          >
            {!modalImageError ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={activeImageUrl ?? ""}
                alt={activeImage.alt ?? ""}
                className="mx-auto block h-auto w-full max-h-[85vh] object-contain"
                onLoad={() => setModalImageError(false)}
                onError={() => setModalImageError(true)}
              />
            ) : (
              <div className="min-w-[320px] max-w-[92vw] px-4 py-16 text-center">
                <p className="text-sm text-rose-500">画像を読み込めませんでした。</p>
                {activeImageUrl && isValidHttpUrl(activeImageUrl) ? (
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
            <div className="flex items-center justify-between gap-3 border-t border-[var(--ui-border)] px-4 py-3">
              <div className="flex items-center gap-2">
                {hasPagination ? (
                  <>
                    <button
                      type="button"
                      onClick={goPrev}
                      className="rounded-full border border-[var(--ui-border)] px-3 py-1 text-sm"
                      aria-label="Previous image"
                    >
                      Prev
                    </button>
                    <span className="text-xs text-[var(--ui-text-subtle)]">
                      {activeIndex + 1} / {images.length}
                    </span>
                    <button
                      type="button"
                      onClick={goNext}
                      className="rounded-full border border-[var(--ui-border)] px-3 py-1 text-sm"
                      aria-label="Next image"
                    >
                      Next
                    </button>
                  </>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setActiveImage(null)}
                className="rounded-full border border-[var(--ui-border)] px-3 py-1 text-sm"
                aria-label="Close image modal"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
