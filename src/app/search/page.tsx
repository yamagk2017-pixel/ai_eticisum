import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import { getNewsPage } from "@/lib/news";
import type { NewsArticle } from "@/lib/news/types";

type SearchParams =
  | Record<string, string | string[] | undefined>
  | Promise<Record<string, string | string[] | undefined>>;

type NandatteResult = {
  id: string;
  name: string;
  slug: string | null;
  imageUrl: string | null;
};

type BuzzResult = {
  id: string;
  idolName: string;
  groupName: string | null;
  groupSlug: string | null;
  createdAt: string | null;
};

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function parsePage(value: string): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.trunc(n));
}

function buildSearchHref(params: { q: string; newsPage?: number }) {
  const search = new URLSearchParams();
  if (params.q.trim()) search.set("q", params.q.trim());
  if (params.newsPage && params.newsPage > 1) search.set("newsPage", String(params.newsPage));
  const query = search.toString();
  return query ? `/search?${query}` : "/search";
}

function formatShortDate(value: string | null) {
  if (!value) return "-";
  const ts = Date.parse(value);
  if (Number.isNaN(ts)) return value;
  return new Intl.DateTimeFormat("ja-JP", { month: "2-digit", day: "2-digit" }).format(new Date(ts));
}

async function searchAllPaged(q: string, newsPage: number) {
  const supabase = createServerClient();
  const keyword = q.trim();
  if (!keyword) {
    return {
      nandatte: [] as NandatteResult[],
      buzzttara: [] as BuzzResult[],
      news: [] as NewsArticle[],
      newsTotal: 0,
      newsPage: 1,
      newsTotalPages: 1,
    };
  }

  const nandattePromise = supabase
    .schema("imd")
    .from("groups")
    .select("id,name_ja,slug,artist_image_url")
    .ilike("name_ja", `%${keyword}%`)
    .order("name_ja", { ascending: true })
    .limit(20);

  const buzzNamePromise = supabase
    .from("tweets")
    .select("id,idol_name,group_id,created_at")
    .ilike("idol_name", `%${keyword}%`)
    .order("created_at", { ascending: false })
    .limit(20);

  const newsByTagPromise = getNewsPage({ page: newsPage, pageSize: 20, tagSlug: keyword.toLowerCase() });

  const [nandatteRes, buzzNameRes, newsByTag] = await Promise.all([
    nandattePromise,
    buzzNamePromise,
    newsByTagPromise,
  ]);

  const nandatte = ((nandatteRes.data ?? []) as Array<{
    id: string;
    name_ja: string | null;
    slug: string | null;
    artist_image_url: string | null;
  }>)
    .filter((row) => typeof row.id === "string" && typeof row.name_ja === "string")
    .map((row) => ({
      id: row.id,
      name: row.name_ja ?? row.id,
      slug: row.slug ?? null,
      imageUrl: row.artist_image_url ?? null,
    }));

  const matchedGroupIds = nandatte.map((item) => item.id);
  const buzzByGroupRes =
    matchedGroupIds.length > 0
      ? await supabase
          .from("tweets")
          .select("id,idol_name,group_id,created_at")
          .in("group_id", matchedGroupIds)
          .order("created_at", { ascending: false })
          .limit(20)
      : { data: [], error: null };

  const buzzRaw = [
    ...((buzzNameRes.data ?? []) as Array<{
      id: string;
      idol_name: string | null;
      group_id: string | null;
      created_at: string | null;
    }>),
    ...((buzzByGroupRes.data ?? []) as Array<{
      id: string;
      idol_name: string | null;
      group_id: string | null;
      created_at: string | null;
    }>),
  ];

  const buzzUnique = new Map<string, { id: string; idol_name: string | null; group_id: string | null; created_at: string | null }>();
  for (const row of buzzRaw) {
    if (!row?.id) continue;
    if (!buzzUnique.has(row.id)) {
      buzzUnique.set(row.id, row);
    }
  }

  const buzzRows = Array.from(buzzUnique.values()).sort((a, b) => {
    const aTs = a.created_at ? Date.parse(a.created_at) : 0;
    const bTs = b.created_at ? Date.parse(b.created_at) : 0;
    return bTs - aTs;
  });

  const buzzGroupIds = Array.from(new Set(buzzRows.map((row) => row.group_id).filter((id): id is string => !!id)));
  const groupMap = new Map<string, { name: string; slug: string | null }>();
  if (buzzGroupIds.length > 0) {
    const groupsRes = await supabase
      .schema("imd")
      .from("groups")
      .select("id,name_ja,slug")
      .in("id", buzzGroupIds);
    for (const row of (groupsRes.data ?? []) as Array<{ id: string; name_ja: string | null; slug: string | null }>) {
      groupMap.set(row.id, { name: row.name_ja ?? row.id, slug: row.slug ?? null });
    }
  }

  const buzzttara: BuzzResult[] = buzzRows
    .map((row) => ({
      id: row.id,
      idolName: row.idol_name ?? "-",
      groupName: row.group_id ? groupMap.get(row.group_id)?.name ?? null : null,
      groupSlug: row.group_id ? groupMap.get(row.group_id)?.slug ?? null : null,
      createdAt: row.created_at,
    }))
    .slice(0, 20);

  const news = newsByTag.items;

  return {
    nandatte,
    buzzttara,
    news,
    newsTotal: newsByTag.total,
    newsPage: newsByTag.page,
    newsTotalPages: newsByTag.totalPages,
  };
}

export default async function SearchPage({ searchParams }: { searchParams?: SearchParams }) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const q = firstParam(resolvedSearchParams.q).trim();
  const newsPage = parsePage(firstParam(resolvedSearchParams.newsPage));
  const hasQuery = q.length > 0;
  const result = hasQuery
    ? await searchAllPaged(q, newsPage)
    : { nandatte: [], buzzttara: [], news: [], newsTotal: 0, newsPage: 1, newsTotalPages: 1 };
  const totalCount = result.nandatte.length + result.buzzttara.length + result.newsTotal;

  return (
    <main className="mx-auto w-full max-w-6xl px-10 py-12 sm:px-12">
      <header className="mb-8">
        <h1 className="font-mincho-jp text-3xl font-semibold tracking-tight sm:text-4xl">検索</h1>
        {hasQuery ? (
          <p className="mt-2 text-sm text-[var(--ui-text-muted)]">
            「{q}」の検索結果: {totalCount}件
          </p>
        ) : (
          <p className="mt-2 text-sm text-[var(--ui-text-muted)]">右上の検索フォームからキーワードを入力してください。</p>
        )}
      </header>

      {hasQuery ? (
        <div className="space-y-12">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
            <section>
              <h2 className="font-mincho-jp text-3xl font-semibold">ナンダッテ</h2>
              {result.nandatte.length > 0 ? (
                <ul className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                  {result.nandatte.map((item) => (
                    <li key={`search-nandatte-${item.id}`} className="rounded-lg p-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-[var(--ui-panel-soft)]">
                          {item.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
                          ) : null}
                        </div>
                        <Link
                          href={item.slug ? `/nandatte/${item.slug}` : "/nandatte"}
                          className="text-sm font-medium underline underline-offset-2"
                        >
                          {item.name}
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-sm text-[var(--ui-text-muted)]">該当なし</p>
              )}
            </section>

            <section>
              <h2 className="font-mincho-jp text-3xl font-semibold">バズッタラ</h2>
              {result.buzzttara.length > 0 ? (
                <ul className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                  {result.buzzttara.map((item) => (
                    <li key={`search-buzz-${item.id}`} className="rounded-lg border border-[var(--ui-border)] p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <Link href={`/buzzttara/tweet/${item.id}`} className="block truncate text-sm font-medium">
                            {item.idolName}
                          </Link>
                          {item.groupName ? (
                            item.groupSlug ? (
                              <Link href={`/nandatte/${item.groupSlug}`} className="text-xs text-[var(--ui-text-muted)]">
                                {item.groupName}
                              </Link>
                            ) : (
                              <p className="text-xs text-[var(--ui-text-muted)]">{item.groupName}</p>
                            )
                          ) : null}
                        </div>
                        <span className="shrink-0 text-xs text-[var(--ui-text-subtle)]">{formatShortDate(item.createdAt)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-sm text-[var(--ui-text-muted)]">該当なし</p>
              )}
            </section>
          </div>

          <section>
            <h2 className="font-mincho-jp text-3xl font-semibold">News</h2>
            {result.news.length > 0 ? (
              <>
                {result.newsTotalPages > 1 ? (
                  <nav aria-label="News pagination top" className="mt-4 flex items-center justify-end gap-2 text-sm">
                    {result.newsPage > 1 ? (
                      <Link
                        href={buildSearchHref({ q, newsPage: result.newsPage - 1 })}
                        className="rounded-md border border-[var(--ui-border)] px-3 py-1"
                      >
                        前へ
                      </Link>
                    ) : (
                      <span className="rounded-md border border-[var(--ui-border)] px-3 py-1 text-[var(--ui-text-subtle)]">前へ</span>
                    )}
                    <span className="text-[var(--ui-text-subtle)]">
                      {result.newsPage} / {result.newsTotalPages}
                    </span>
                    {result.newsPage < result.newsTotalPages ? (
                      <Link
                        href={buildSearchHref({ q, newsPage: result.newsPage + 1 })}
                        className="rounded-md border border-[var(--ui-border)] px-3 py-1"
                      >
                        次へ
                      </Link>
                    ) : (
                      <span className="rounded-md border border-[var(--ui-border)] px-3 py-1 text-[var(--ui-text-subtle)]">次へ</span>
                    )}
                  </nav>
                ) : null}
                <ul className="mt-4 space-y-3">
                  {result.news.map((article) => (
                    <li key={`search-news-${article.path}`} className="rounded-lg p-3">
                      <div className="flex items-center gap-3">
                        <Link href={article.path} className="shrink-0">
                          {article.featuredImageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={article.featuredImageUrl}
                              alt={article.featuredImageAlt ?? ""}
                              className="h-12 w-20 rounded-md object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex h-12 w-20 items-center justify-center rounded-md bg-[var(--ui-panel-soft)] text-[10px] text-[var(--ui-text-subtle)]">
                              No Image
                            </div>
                          )}
                        </Link>
                        <div className="min-w-0 flex-1">
                          <Link
                            href={article.path}
                            className="block truncate text-sm font-medium underline underline-offset-2"
                            dangerouslySetInnerHTML={{ __html: article.titleHtml }}
                          />
                          <p className="mt-1 text-xs text-[var(--ui-text-subtle)]">{formatShortDate(article.publishedAt)}</p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
                {result.newsTotalPages > 1 ? (
                  <nav aria-label="News pagination bottom" className="mt-4 flex items-center justify-center gap-2 text-sm">
                    {result.newsPage > 1 ? (
                      <Link
                        href={buildSearchHref({ q, newsPage: result.newsPage - 1 })}
                        className="rounded-md border border-[var(--ui-border)] px-3 py-1"
                      >
                        前へ
                      </Link>
                    ) : (
                      <span className="rounded-md border border-[var(--ui-border)] px-3 py-1 text-[var(--ui-text-subtle)]">前へ</span>
                    )}
                    <span className="text-[var(--ui-text-subtle)]">
                      {result.newsPage} / {result.newsTotalPages}
                    </span>
                    {result.newsPage < result.newsTotalPages ? (
                      <Link
                        href={buildSearchHref({ q, newsPage: result.newsPage + 1 })}
                        className="rounded-md border border-[var(--ui-border)] px-3 py-1"
                      >
                        次へ
                      </Link>
                    ) : (
                      <span className="rounded-md border border-[var(--ui-border)] px-3 py-1 text-[var(--ui-text-subtle)]">次へ</span>
                    )}
                  </nav>
                ) : null}
              </>
            ) : (
              <p className="mt-4 text-sm text-[var(--ui-text-muted)]">該当なし</p>
            )}
          </section>
        </div>
      ) : null}
    </main>
  );
}
