import Image from "next/image";
import Link from "next/link";
import {formatNewsDate} from "@/lib/news/datetime";
import type {NewsTag} from "@/lib/news/types";

export function FeatureArticleHero({
  titleHtml,
  imageUrl,
  imageAlt = "",
  publishedAt,
  categories,
  tags,
}: {
  titleHtml: string;
  imageUrl: string;
  imageAlt?: string;
  publishedAt: string | null;
  categories: NewsTag[];
  tags: NewsTag[];
}) {
  return (
    <header
      data-feature-hero
      className="relative isolate md:grid md:grid-cols-1 md:bg-zinc-950"
    >
      <Image
        src={imageUrl}
        alt={imageAlt}
        width={1600}
        height={900}
        sizes="(min-width: 1152px) 1056px, (min-width: 640px) calc(100vw - 96px), calc(100vw - 48px)"
        className="block h-auto w-full object-contain md:col-start-1 md:row-start-1 md:self-start"
        preload
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 hidden bg-[linear-gradient(180deg,rgba(0,0,0,0)_0%,rgba(0,0,0,0)_65%,rgba(0,0,0,0.85)_100%)] md:block"
      />
      <div className="relative mt-4 min-w-0 text-[var(--ui-text)] md:col-start-1 md:row-start-1 md:mt-0 md:grid md:grid-cols-[auto_minmax(0,1fr)] md:items-center md:gap-x-4 md:self-end md:px-10 md:pt-40 md:pb-6 md:text-white md:[text-shadow:0_2px_12px_rgb(0_0_0/0.6)] lg:px-12 lg:pb-8">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs md:col-start-1 md:row-start-1">
          {categories.map((category) => (
            category.slug ? (
              <Link
                key={category.id}
                href={`/news?category=${category.slug}`}
                className="underline underline-offset-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 md:rounded-full md:border md:border-white/40 md:bg-black/20 md:px-3 md:py-1 md:text-white md:no-underline md:hover:bg-white/15 md:focus-visible:outline-white"
              >
                {category.name}
              </Link>
            ) : (
              <span key={category.id} className="underline underline-offset-2 md:rounded-full md:border md:border-white/40 md:bg-black/20 md:px-3 md:py-1 md:no-underline">
                {category.name}
              </span>
            )
          ))}
          {publishedAt ? (
            <time dateTime={publishedAt} className="tracking-wide text-[var(--ui-text-subtle)] md:text-white/90">
              {formatNewsDate(publishedAt, {dateStyle: "medium", timeStyle: "short"})}
            </time>
          ) : null}
        </div>
        <h1
          className="mt-2 w-full font-mincho-jp text-xl font-semibold leading-[1.45] [overflow-wrap:anywhere] md:col-span-2 md:row-start-2 md:text-3xl md:leading-[1.4] md:text-white lg:text-[2.5rem]"
          dangerouslySetInnerHTML={{__html: titleHtml}}
        />
        {tags.length > 0 ? (
          <div className="mt-4 flex min-w-0 flex-wrap gap-2 md:col-start-2 md:row-start-1 md:mt-0 md:justify-end">
            {tags.map((tag) => (
              tag.slug ? (
                <Link
                  key={tag.id}
                  href={`/news?tag=${tag.slug}`}
                  className="max-w-full rounded-full border border-[var(--ui-border)] px-2.5 py-1 text-xs [overflow-wrap:anywhere] transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 md:border-white/35 md:bg-black/20 md:text-white md:hover:bg-white/15 md:focus-visible:outline-white"
                >
                  {tag.name}
                </Link>
              ) : (
                <span key={tag.id} className="max-w-full rounded-full border border-[var(--ui-border)] px-2.5 py-1 text-xs [overflow-wrap:anywhere] md:border-white/35 md:bg-black/20">
                  {tag.name}
                </span>
              )
            ))}
          </div>
        ) : null}
      </div>
    </header>
  );
}
