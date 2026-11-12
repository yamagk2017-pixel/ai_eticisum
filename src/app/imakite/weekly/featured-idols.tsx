import Image from "next/image";
import type { FeaturedIdol } from "@/lib/imakite-weekly-data";
import { IdolProfile } from "./idol-profile";

function IdolIntroduction({ idol, cover = false }: { idol: FeaturedIdol; cover?: boolean }) {
  return (
    <article className={`grid min-w-0 items-start ${idol.imageUrl ? cover ? "gap-5 md:grid-cols-[256px_minmax(0,1fr)] md:gap-8" : "grid-cols-[80px_minmax(0,1fr)] gap-4 sm:grid-cols-[128px_minmax(0,1fr)] sm:gap-6" : ""}`}>
      {idol.imageUrl && (
        <div className="min-w-0">
          <Image
            src={idol.imageUrl}
            alt={idol.name ? `${idol.name} アーティスト写真` : "アーティスト写真"}
            width={800}
            height={800}
            unoptimized
            loading={cover ? "eager" : "lazy"}
            className={`aspect-square h-auto w-full rounded-lg object-contain ${cover ? "max-w-64" : ""}`}
          />
        </div>
      )}
      <div className="flex min-w-0 flex-col gap-4">
        <div className="space-y-3">
          {idol.name && <h3 className={`font-mincho-jp break-words font-semibold leading-tight ${cover ? "text-3xl sm:text-4xl" : "text-xl sm:text-2xl"}`}>{idol.name}</h3>}
          {idol.trackName && (
            <p className="break-words text-base font-medium leading-relaxed">
              <span className="mb-1 block text-xs font-normal tracking-wider text-[var(--ui-text-subtle)]">今回の掲載曲</span>
              {idol.trackName}
            </p>
          )}
        </div>
        {idol.profile && <IdolProfile body={idol.profile} />}
        {idol.links.length > 0 && (
          <ul aria-label={idol.name ? `${idol.name}の公式リンク` : "公式リンク"} className="flex flex-wrap gap-x-4 gap-y-1">
            {idol.links.map((link) => (
              <li key={link.url} className="min-w-0 max-w-full">
                <a href={link.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center break-all text-xs font-medium text-[var(--ui-link)] underline underline-offset-4 hover:text-[var(--ui-link-hover)]">
                  {link.label} ↗
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}

export function FeaturedIdols({ idols }: { idols: FeaturedIdol[] }) {
  const [cover, ...others] = idols;
  if (!cover) return null;
  return (
    <div className="flex flex-col gap-10">
      <section aria-labelledby="cover-idol-heading" className="space-y-5">
        <h2 id="cover-idol-heading" className="font-mincho-jp text-xl font-semibold sm:text-2xl">今週のカバーアイドル</h2>
        <IdolIntroduction idol={cover} cover />
      </section>
      {others.length > 0 && (
        <section aria-labelledby="featured-idols-heading" className="space-y-5">
          <h2 id="featured-idols-heading" className="font-mincho-jp text-xl font-semibold sm:text-2xl">こちらのアイドルもチェック</h2>
          <div className="flex flex-col gap-8">
            {others.map((idol) => <IdolIntroduction key={idol.groupId} idol={idol} />)}
          </div>
        </section>
      )}
    </div>
  );
}
