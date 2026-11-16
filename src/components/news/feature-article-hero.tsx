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
      className="relative isolate grid grid-cols-1 overflow-hidden bg-zinc-950"
    >
      <div aria-hidden="true" className="col-start-1 row-start-1 aspect-[4/3] sm:aspect-[16/9]" />
      <Image
        src={imageUrl}
        alt={imageAlt}
        fill
        sizes="(min-width: 1152px) 1056px, (min-width: 640px) calc(100vw - 96px), calc(100vw - 48px)"
        className="object-cover object-[center_35%]"
        preload
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.02)_10%,rgba(0,0,0,0.12)_35%,rgba(0,0,0,0.85)_100%)]"
      />
      <div className="relative col-start-1 row-start-1 min-w-0 self-end px-5 pt-20 pb-4 text-white [text-shadow:0_2px_12px_rgb(0_0_0/0.6)] sm:px-10 sm:pt-40 sm:pb-6 lg:px-12 lg:pb-8">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs">
          {categories.map((category) => (
            category.slug ? (
              <Link
                key={category.id}
                href={`/news?category=${category.slug}`}
                className="rounded-full border border-white/40 bg-black/20 px-3 py-1 text-white transition-colors hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
              >
                {category.name}
              </Link>
            ) : (
              <span key={category.id} className="rounded-full border border-white/40 bg-black/20 px-3 py-1">
                {category.name}
              </span>
            )
          ))}
          {publishedAt ? (
            <time dateTime={publishedAt} className="tracking-wide text-white/90">
              {formatNewsDate(publishedAt, {dateStyle: "medium", timeStyle: "short"})}
            </time>
          ) : null}
        </div>
        <h1
          className="mt-2 w-full font-mincho-jp text-xl font-semibold leading-[1.45] text-white [overflow-wrap:anywhere] sm:text-3xl sm:leading-[1.4] lg:text-[2.5rem]"
          dangerouslySetInnerHTML={{__html: titleHtml}}
        />
        {tags.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {tags.map((tag) => (
              tag.slug ? (
                <Link
                  key={tag.id}
                  href={`/news?tag=${tag.slug}`}
                  className="max-w-full rounded-full border border-white/35 bg-black/20 px-2.5 py-1 text-xs text-white [overflow-wrap:anywhere] transition-colors hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
                >
                  {tag.name}
                </Link>
              ) : (
                <span key={tag.id} className="max-w-full rounded-full border border-white/35 bg-black/20 px-2.5 py-1 text-xs [overflow-wrap:anywhere]">
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
