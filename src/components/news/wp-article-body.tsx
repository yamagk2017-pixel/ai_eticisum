"use client";

import type { MouseEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

type ImageModalState = {
  src: string;
  alt: string;
};

const BODY_CLASSNAME =
  "mt-6 space-y-4 text-[17px] leading-8 text-[var(--ui-text)] [overflow-wrap:anywhere] after:block after:clear-both after:content-[''] [&_.alignright]:ml-auto [&_.alignright]:mr-0 [&_.alignright]:block [&_div.alignright]:float-right [&_div.alignright]:ml-4 [&_div.alignright]:mb-1 [&_div.alignright]:max-w-[55%] [&_div.alignright]:w-fit [&_div.alignright_img]:max-w-full [&_.wp-caption]:max-w-full [&_.wp-caption]:border [&_.wp-caption]:border-[var(--ui-border)] [&_.wp-caption]:bg-[var(--ui-panel-soft)] [&_.wp-caption]:px-2 [&_.wp-caption]:pt-2 [&_.wp-caption]:pb-1 [&_.wp-caption_img]:block [&_.wp-caption_img]:h-auto [&_.wp-caption_img]:max-w-full [&_.wp-caption-text]:mt-2 [&_.wp-caption-text]:mb-0 [&_.wp-caption-text]:px-1 [&_.wp-caption-text]:text-xs [&_.wp-caption-text]:leading-5 [&_.wp-caption-text]:text-[var(--ui-text-subtle)] [&_img.alignright]:float-right [&_img.alignright]:ml-4 [&_img.alignright]:mb-2 [&_img.alignright]:max-w-[55%] [&_p:has(img.alignright)]:overflow-hidden [&_p:has(div.alignright)]:overflow-hidden [&_.well3]:my-6 [&_.well3]:rounded-xl [&_.well3]:border [&_.well3]:border-[var(--ui-border)] [&_.well3]:bg-[var(--ui-panel-soft)] [&_.well3]:px-4 [&_.well3]:py-3 [&_.well3]:text-[17px] [&_.well3]:leading-8 [&_.well3]:text-[var(--ui-text)] [&_.well3_p]:my-0 [&_.well3_p]:px-0 [&_.well3_*]:text-inherit [&_a]:underline [&_a]:underline-offset-2 [&_a]:break-all [&_a]:whitespace-normal [&_h2]:mt-12 [&_h2]:mb-4 [&_h2]:border-b [&_h2]:border-zinc-400 dark:[&_h2]:border-zinc-500 [&_h2]:pb-3 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:leading-tight [&_h2]:[font-family:var(--font-shippori-mincho),serif] sm:[&_h2]:text-2xl [&_h3]:mt-8 [&_h3]:mb-1 [&_h3]:inline-block [&_h3]:border-b [&_h3]:border-zinc-400 dark:[&_h3]:border-zinc-500 [&_h3]:pb-0 [&_h3]:text-[1rem] [&_h3]:font-bold [&_h3]:leading-snug [&_h3]:text-zinc-700 dark:[&_h3]:text-zinc-300 sm:[&_h3]:text-[1.15rem] [&_img]:h-auto [&_img]:max-w-full [&_.foogallery]:my-6 [&_.foogallery]:flex [&_.foogallery]:flex-wrap [&_.foogallery]:items-start [&_.foogallery]:gap-1 sm:[&_.foogallery]:gap-2 [&_.foogallery_.fg-item]:m-0 [&_.foogallery_.fg-item]:shrink-0 [&_.foogallery_.fg-thumb]:block [&_.foogallery_.fg-image-wrap]:block [&_.foogallery_.fg-image]:block [&_.foogallery_.fg-loader]:hidden [&_.foogallery_figcaption]:mt-1 [&_.foogallery_figcaption]:text-xs [&_.foogallery_figcaption]:leading-5 [&_.foogallery_figcaption]:text-[var(--ui-text-subtle)] [&_p]:mt-4 [&_p]:mb-5 [&_p]:px-2 sm:[&_p]:px-3 [&_p]:leading-[2.1] [&_p]:text-zinc-700 dark:[&_p]:text-zinc-200 [&_li]:text-[var(--ui-text)] [&_span]:text-inherit [&_strong]:text-inherit [&_em]:text-inherit [&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6";

function isImageHref(href: string) {
  return /\.(avif|gif|jpe?g|png|webp|bmp|svg)(\?.*)?$/i.test(href);
}

function readHtmlAttr(tag: string, attrName: string) {
  const escaped = attrName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = tag.match(new RegExp(`\\s${escaped}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i"));
  if (!match) return null;
  return (match[2] ?? match[3] ?? "").trim();
}

function setHtmlAttr(tag: string, attrName: string, attrValue: string) {
  const escaped = attrName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const quoted = `"${attrValue.replaceAll('"', "&quot;")}"`;
  if (new RegExp(`\\s${escaped}\\s*=`, "i").test(tag)) {
    return tag.replace(new RegExp(`(\\s${escaped}\\s*=\\s*)("([^"]*)"|'([^']*)')`, "i"), `$1${quoted}`);
  }
  return tag.replace(/\s*\/?>$/, (end) => ` ${attrName}=${quoted}${end}`);
}

function normalizeLazyGalleryImages(html: string) {
  return html.replace(/<img\b[^>]*>/gi, (imgTag) => {
    const lazySrc = readHtmlAttr(imgTag, "data-src-fg") ?? readHtmlAttr(imgTag, "data-src");
    if (!lazySrc) return imgTag;

    const src = readHtmlAttr(imgTag, "src");
    if (src && !src.startsWith("data:image/svg+xml") && !src.startsWith("data:image/gif;base64")) {
      return imgTag;
    }

    return setHtmlAttr(imgTag, "src", lazySrc);
  });
}

export function WpArticleBody({ html }: { html: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [modalImage, setModalImage] = useState<ImageModalState | null>(null);
  const normalizedHtml = useMemo(() => normalizeLazyGalleryImages(html), [html]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (modalImage) {
      if (!dialog.open) dialog.showModal();
      return;
    }
    if (dialog.open) dialog.close();
  }, [modalImage]);

  const handleBodyClick = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const anchor = target.closest("a");
    if (!(anchor instanceof HTMLAnchorElement)) return;

    const image = anchor.querySelector("img");
    if (!(image instanceof HTMLImageElement)) return;
    if (!isImageHref(anchor.href)) return;

    event.preventDefault();
    setModalImage({ src: anchor.href, alt: image.alt || "" });
  };

  const closeModal = () => setModalImage(null);

  return (
    <>
      <div className={BODY_CLASSNAME} onClick={handleBodyClick} dangerouslySetInnerHTML={{ __html: normalizedHtml }} />
      <dialog
        ref={dialogRef}
        onClose={closeModal}
        onClick={(event) => {
          if (event.target === event.currentTarget) closeModal();
        }}
        className="max-h-[92vh] max-w-[92vw] rounded-xl border border-[var(--ui-border)] bg-[var(--ui-panel)] p-0 text-[var(--ui-text)] backdrop:bg-black/70"
      >
        {modalImage ? (
          <div className="relative">
            <button
              type="button"
              onClick={closeModal}
              className="absolute right-2 top-2 z-10 rounded-full bg-black/70 px-3 py-1 text-sm text-white"
              aria-label="Close image modal"
            >
              Close
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={modalImage.src}
              alt={modalImage.alt}
              className="block max-h-[90vh] max-w-[92vw] object-contain"
            />
          </div>
        ) : null}
      </dialog>
    </>
  );
}
