"use client";

import {useEffect, useRef, useState} from "react";

type GalleryImage = {
  url: string;
  alt: string | null;
  caption: string | null;
};

export function SanityGallery({images}: {images: GalleryImage[]}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (activeIndex !== null) {
      if (!dialog.open) dialog.showModal();
      return;
    }
    if (dialog.open) dialog.close();
  }, [activeIndex]);

  const activeImage = activeIndex !== null ? images[activeIndex] ?? null : null;

  return (
    <>
      <section className="mt-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {images.map((image, index) => (
            <figure key={`gallery-${index}`} className="space-y-2">
              <button
                type="button"
                onClick={() => setActiveIndex(index)}
                className="block w-full text-left"
                aria-label={`Open image ${index + 1}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image.url}
                  alt={image.alt ?? ""}
                  className="h-auto w-full rounded-xl border border-[var(--ui-border)] object-cover"
                />
              </button>
              {image.caption ? <figcaption className="text-xs text-[var(--ui-text-subtle)]">{image.caption}</figcaption> : null}
            </figure>
          ))}
        </div>
      </section>

      <dialog
        ref={dialogRef}
        onClose={() => setActiveIndex(null)}
        onClick={(event) => {
          if (event.target === event.currentTarget) setActiveIndex(null);
        }}
        className="max-h-[92vh] max-w-[92vw] rounded-xl border border-[var(--ui-border)] bg-[var(--ui-panel)] p-0 text-[var(--ui-text)] backdrop:bg-black/70"
      >
        {activeImage ? (
          <div className="relative">
            <button
              type="button"
              onClick={() => setActiveIndex(null)}
              className="absolute right-2 top-2 z-10 rounded-full bg-black/70 px-3 py-1 text-sm text-white"
              aria-label="Close image modal"
            >
              Close
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={activeImage.url} alt={activeImage.alt ?? ""} className="block max-h-[90vh] max-w-[92vw] object-contain" />
            {activeImage.caption ? <p className="px-4 py-3 text-xs text-[var(--ui-text-subtle)]">{activeImage.caption}</p> : null}
          </div>
        ) : null}
      </dialog>
    </>
  );
}

