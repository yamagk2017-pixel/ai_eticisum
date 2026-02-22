import Link from "next/link";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { SafeTweetEmbed } from "@/app/buzzttara/safe-tweet-embed";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type RowRecord = Record<string, unknown>;

type ImakiteSummaryItem = {
  rank: number;
  groupId: string;
  slug: string | null;
  name: string;
  point: number;
  latestTrackName: string | null;
  artistImageUrl: string | null;
  playerEmbedUrl: string | null;
};

type ImakiteSummary = {
  latestDate: string | null;
  items: ImakiteSummaryItem[];
  weeklyPlaylistDate: string | null;
  weeklyPlaylistEmbedUrl: string | null;
};

type NandatteSummaryItem = {
  groupId: string;
  name: string;
  slug: string | null;
  imageUrl: string | null;
  voteCount: number;
  lastVoteAt: string | null;
};

type BuzzSummaryItem = {
  id: string;
  idolName: string;
  tweetUrl: string;
  groupSlug: string | null;
  groupName: string | null;
  createdAt: string | null;
  viewCount: number | null;
  likeCount: number | null;
  tags: Array<{
    id: string;
    likeCount: number | null;
    name: string | null;
    icon: string | null;
  }>;
};

function asRecord(value: unknown): RowRecord {
  return value && typeof value === "object" ? (value as RowRecord) : {};
}

function pickString(row: RowRecord, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return null;
}

function pickNumber(row: RowRecord, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const n = Number(value);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

function formatPoint(value: number) {
  return new Intl.NumberFormat("ja-JP", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatShortDate(value: string | null) {
  if (!value) return "-";
  const ts = Date.parse(value);
  if (Number.isNaN(ts)) return value;
  return new Intl.DateTimeFormat("ja-JP", { month: "2-digit", day: "2-digit" }).format(new Date(ts));
}

function formatCount(value: number | null) {
  if (value === null) return "-";
  return new Intl.NumberFormat("ja-JP").format(value);
}

function extractTweetId(tweetUrl: string): string | null {
  const match = tweetUrl.match(/status\/(\d+)/);
  return match?.[1] ?? null;
}

async function getHomeSummaries() {
  const fallback = {
    imakite: {
      latestDate: null,
      items: [] as ImakiteSummaryItem[],
      weeklyPlaylistDate: null,
      weeklyPlaylistEmbedUrl: null,
    } satisfies ImakiteSummary,
    nandatte: { voteTop: [] as NandatteSummaryItem[], recentTop: [] as NandatteSummaryItem[] },
    buzz: { items: [] as BuzzSummaryItem[] },
  };
  const errors: string[] = [];

  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    const supabase =
      url && anonKey
        ? createSupabaseClient(url, anonKey, {
            auth: { persistSession: false, autoRefreshToken: false },
          })
        : createServerClient();

    const imakitePromise = (async () => {
      try {
        const latest = await supabase
          .schema("ihc")
          .from("daily_top20")
          .select("snapshot_date")
          .order("snapshot_date", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (latest.error) throw new Error(`IMAKITE latest date: ${latest.error.message}`);

        const latestDate = (latest.data as { snapshot_date?: string } | null)?.snapshot_date ?? null;
        if (!latestDate) return fallback.imakite;

        const rowsRes = await supabase
          .schema("ihc")
          .from("daily_top20")
          .select("*")
          .eq("snapshot_date", latestDate)
          .order("rank", { ascending: true })
          .limit(5);
        if (rowsRes.error) throw new Error(`IMAKITE rows: ${rowsRes.error.message}`);

        const baseItems: ImakiteSummaryItem[] = ((rowsRes.data ?? []) as unknown[])
          .map((row) => {
            const r = asRecord(row);
            return {
              rank: pickNumber(r, ["rank"]) ?? 0,
              groupId: pickString(r, ["group_id"]) ?? "",
              slug: null,
              name: pickString(r, ["artist_name", "group_name"]) ?? "-",
              point: pickNumber(r, ["total_score", "score", "weekly_score"]) ?? 0,
              latestTrackName: pickString(r, ["latest_track_name", "track_name"]),
              artistImageUrl: pickString(r, ["artist_image_url", "image_url"]),
              playerEmbedUrl: pickString(r, [
                "latest_track_embed_link",
                "track_embed_link",
                "spotify_embed_url",
              ]),
            };
          })
          .filter((row) => row.rank > 0)
          .sort((a, b) => a.rank - b.rank)
          .slice(0, 3);

        const groupIds = Array.from(
          new Set(baseItems.map((row) => row.groupId).filter((id) => id.length > 0))
        );
        let items = baseItems;

        if (groupIds.length > 0) {
          const groupsRes = await supabase
            .schema("imd")
            .from("groups")
            .select("id,slug,artist_image_url")
            .in("id", groupIds);

          const groupMap = new Map<string, { slug: string | null; artist_image_url: string | null }>();
          if (!groupsRes.error) {
            for (const row of (groupsRes.data ?? []) as Array<{
              id: string;
              slug: string | null;
              artist_image_url: string | null;
            }>) {
              groupMap.set(row.id, {
                slug: row.slug ?? null,
                artist_image_url: row.artist_image_url ?? null,
              });
            }
          }

          items = baseItems.map((item) => {
            const group = groupMap.get(item.groupId);
            return {
              ...item,
              slug: group?.slug ?? item.slug,
              artistImageUrl: group?.artist_image_url ?? item.artistImageUrl,
            };
          });
        }

        const weeklyRes = await supabase
          .schema("ihc")
          .from("weekly_playlists")
          .select("week_end_date,spotify_embed_url,spotify_playlist_url")
          .order("week_end_date", { ascending: false })
          .limit(1)
          .maybeSingle();

        const weeklyRow = asRecord(weeklyRes.data ?? null);
        const weeklyPlaylistEmbedUrl = weeklyRes.error
          ? null
          : pickString(weeklyRow, ["spotify_embed_url", "spotify_playlist_url"]);
        const weeklyPlaylistDate = weeklyRes.error ? null : pickString(weeklyRow, ["week_end_date"]);

        return { latestDate, items, weeklyPlaylistDate, weeklyPlaylistEmbedUrl };
      } catch (error) {
        errors.push(error instanceof Error ? error.message : "IMAKITE summary error");
        return fallback.imakite;
      }
    })();

    const nandattePromise = (async () => {
      try {
        const [voteRes, recentRes] = await Promise.all([
          supabase.schema("nandatte").rpc("get_vote_top5"),
          supabase.schema("nandatte").rpc("get_recent_vote_top5"),
        ]);
        if (voteRes.error || recentRes.error) {
          throw new Error(voteRes.error?.message ?? recentRes.error?.message ?? "NANDATTE RPC error");
        }

        const voteRows = ((voteRes.data ?? []) as unknown[]).map(asRecord);
        const recentRows = ((recentRes.data ?? []) as unknown[]).map(asRecord);
        const groupIds = Array.from(
          new Set(
            [...voteRows, ...recentRows]
              .map((row) => pickString(row, ["group_id"]))
              .filter((id): id is string => !!id)
          )
        );

        const groupMap = new Map<string, { name: string; slug: string | null; imageUrl: string | null }>();
        if (groupIds.length > 0) {
          const groupsRes = await supabase
            .schema("imd")
            .from("groups")
            .select("id,name_ja,slug,artist_image_url")
            .in("id", groupIds);
          if (!groupsRes.error) {
            for (const row of (groupsRes.data ?? []) as Array<{
              id: string;
              name_ja: string | null;
              slug: string | null;
              artist_image_url: string | null;
            }>) {
              groupMap.set(row.id, {
                name: row.name_ja ?? row.id,
                slug: row.slug ?? null,
                imageUrl: row.artist_image_url ?? null,
              });
            }
          }
        }

        const mapItem = (row: RowRecord): NandatteSummaryItem => {
          const groupId = pickString(row, ["group_id"]) ?? "";
          const group = groupMap.get(groupId);
          return {
            groupId,
            name: group?.name ?? groupId ?? "-",
            slug: group?.slug ?? null,
            imageUrl: group?.imageUrl ?? null,
            voteCount: pickNumber(row, ["vote_count"]) ?? 0,
            lastVoteAt: pickString(row, ["last_vote_at"]),
          };
        };

        return {
          voteTop: voteRows.map(mapItem).slice(0, 3),
          recentTop: recentRows.map(mapItem).slice(0, 3),
        };
      } catch (error) {
        errors.push(error instanceof Error ? error.message : "NANDATTE summary error");
        return fallback.nandatte;
      }
    })();

    const buzzPromise = (async () => {
      try {
        const tweetsRes = await supabase
          .from("tweets")
          .select("id,tweet_url,idol_name,group_id,created_at,view_count,like_count,tweet_tags(id,like_count,tags(id,name,icon))")
          .order("created_at", { ascending: false })
          .limit(1);
        if (tweetsRes.error) throw new Error(`BUZZTTARA tweets: ${tweetsRes.error.message}`);

        const rows = ((tweetsRes.data ?? []) as Array<{
          id: string;
          tweet_url: string | null;
          idol_name: string | null;
          group_id: string | null;
          created_at: string | null;
          view_count: number | null;
          like_count: number | null;
          tweet_tags?: Array<{
            id: string | null;
            like_count: number | null;
            tags?: { id?: string | null; name?: string | null; icon?: string | null } | null;
          }> | null;
        }>).filter((row) => !!row.id && !!row.idol_name && !!row.tweet_url);

        const groupIds = Array.from(
          new Set(rows.map((row) => row.group_id).filter((id): id is string => !!id))
        );
        const groupMap = new Map<string, string>();
        const groupSlugMap = new Map<string, string | null>();
        if (groupIds.length > 0) {
          const groupsRes = await supabase
            .schema("imd")
            .from("groups")
            .select("id,name_ja,slug")
            .in("id", groupIds);
          if (!groupsRes.error) {
            for (const row of (groupsRes.data ?? []) as Array<{ id: string; name_ja: string | null; slug: string | null }>) {
              groupMap.set(row.id, row.name_ja ?? row.id);
              groupSlugMap.set(row.id, row.slug ?? null);
            }
          }
        }

        return {
          items: rows.map((row) => ({
            id: row.id,
            idolName: row.idol_name ?? "-",
            tweetUrl: row.tweet_url ?? "",
            groupSlug: row.group_id ? groupSlugMap.get(row.group_id) ?? null : null,
            groupName: row.group_id ? groupMap.get(row.group_id) ?? null : null,
            createdAt: row.created_at,
            viewCount: row.view_count,
            likeCount: row.like_count,
            tags: (row.tweet_tags ?? []).map((tag) => ({
              id: tag.id ?? crypto.randomUUID(),
              likeCount: tag.like_count ?? null,
              name: tag.tags?.name ?? null,
              icon: tag.tags?.icon ?? null,
            })),
          })),
        };
      } catch (error) {
        errors.push(error instanceof Error ? error.message : "BUZZTTARA summary error");
        return fallback.buzz;
      }
    })();

    const [imakite, nandatte, buzz] = await Promise.all([imakitePromise, nandattePromise, buzzPromise]);

    return {
      ok: errors.length === 0,
      imakite,
      nandatte,
      buzz,
      error: errors.length ? errors.join(" | ") : null,
    };
  } catch (error) {
    return {
      ok: false as const,
      ...fallback,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export default async function Home() {
  const summaries = await getHomeSummaries();
  const imakiteTop1 = summaries.imakite.items.find((item) => item.rank === 1) ?? summaries.imakite.items[0] ?? null;
  const imakiteRunnersUp = summaries.imakite.items.filter((item) => (imakiteTop1 ? item.rank !== imakiteTop1.rank : true));

  return (
    <div className="min-h-screen bg-[var(--ui-page)] text-[var(--ui-text)]">
      <main className="mx-auto w-full max-w-6xl px-6 py-10 sm:py-14 [&_a]:underline [&_a]:decoration-current/60 [&_a]:underline-offset-2">
        <section className="columns-1 gap-6 lg:columns-3">
          <div className="mb-6 break-inside-avoid rounded-xl border border-[var(--ui-border)] bg-[var(--ui-panel)] p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-500">
                  IMAKITE RANKING
                </p>
                <h2 className="mt-2 text-lg font-semibold">デイリーランキング</h2>
              </div>
              <Link
                href="/imakite"
                className="rounded-full border border-[var(--ui-border)] px-3 py-1 text-xs text-[var(--ui-text-muted)] hover:bg-[var(--ui-panel-soft)]"
              >
                詳細へ
              </Link>
            </div>
            {summaries.imakite.latestDate && (
              <p className="mt-2 text-xs text-[var(--ui-text-subtle)]">{summaries.imakite.latestDate} 時点</p>
            )}
            {imakiteTop1 ? (
              <>
                <article className="relative mt-4 overflow-hidden rounded-xl border border-white/10 bg-slate-900/70 shadow-lg">
                  <div className="absolute inset-0">
                    {imakiteTop1.artistImageUrl ? (
                      <img
                        src={imakiteTop1.artistImageUrl}
                        alt={imakiteTop1.name}
                        className="h-full w-full object-cover opacity-70"
                        loading="lazy"
                      />
                    ) : (
                      <div className="h-full w-full bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-b from-slate-950/20 via-slate-950/40 to-slate-950/90" />
                  </div>

                  <div className="relative flex flex-col gap-4 p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-amber-300">1位</p>
                        <h3 className="mt-1 text-xl font-semibold text-white sm:text-2xl">
                          {imakiteTop1.slug ? (
                            <Link
                              href={`/nandatte/${imakiteTop1.slug}`}
                              className="underline decoration-amber-200/70 underline-offset-4 hover:text-amber-100"
                            >
                              {imakiteTop1.name}
                            </Link>
                          ) : (
                            imakiteTop1.name
                          )}
                        </h3>
                        {imakiteTop1.latestTrackName && (
                          <p className="mt-1 text-sm text-zinc-200">♪ {imakiteTop1.latestTrackName}</p>
                        )}
                      </div>
                      <div className="rounded-full bg-black/40 px-3 py-1 text-sm font-semibold text-amber-200">
                        {formatPoint(imakiteTop1.point)} pts
                      </div>
                    </div>

                  </div>
                </article>

                <ol className="mt-4 space-y-2 text-sm">
                  {imakiteRunnersUp.map((item) => (
                    <li
                      key={`imakite-${item.rank}-${item.name}`}
                      className="flex items-center justify-between gap-3 rounded-md"
                    >
                      <span className="truncate">
                        <span className="mr-2 text-xs text-[var(--ui-text-subtle)]">#{item.rank}</span>
                        {item.slug ? (
                          <Link href={`/nandatte/${item.slug}`}>{item.name}</Link>
                        ) : (
                          item.name
                        )}
                      </span>
                      <span className="shrink-0 text-xs font-medium text-[var(--ui-text-muted)]">
                        {formatPoint(item.point)} pt
                      </span>
                    </li>
                  ))}
                </ol>

              </>
            ) : (
              <div className="mt-4 rounded-md text-xs text-[var(--ui-text-muted)]">
                データを取得できませんでした。
              </div>
            )}
          </div>

          {summaries.imakite.weeklyPlaylistEmbedUrl && (
            <div className="mb-6 break-inside-avoid rounded-xl border border-[var(--ui-border)] bg-[var(--ui-panel)] p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-500">
                    IMAKITE RANKING
                  </p>
                  <h2 className="mt-2 text-lg font-semibold">週間ランキング</h2>
                </div>
                <Link
                  href="/imakite/weekly"
                  className="rounded-full border border-[var(--ui-border)] px-3 py-1 text-xs text-[var(--ui-text-muted)] hover:bg-[var(--ui-panel-soft)]"
                >
                  詳細へ
                </Link>
              </div>
              {summaries.imakite.weeklyPlaylistDate && (
                <p className="mt-2 text-xs text-[var(--ui-text-subtle)]">
                  {summaries.imakite.weeklyPlaylistDate} 時点
                </p>
              )}
              <div className="mt-4 overflow-hidden rounded-lg border border-[var(--ui-border)]">
                <iframe
                  title="IMAKITE Weekly Ranking Playlist"
                  src={summaries.imakite.weeklyPlaylistEmbedUrl}
                  width="100%"
                  height={352}
                  allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                  loading="lazy"
                />
              </div>
            </div>
          )}

          <div className="mb-6 break-inside-avoid rounded-xl border border-[var(--ui-border)] bg-[var(--ui-panel)] p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-500">
                    NANDATTE
                  </p>
                  <h2 className="mt-2 text-lg font-semibold">投票ランキング</h2>
                </div>
                <Link
                  href="/nandatte"
                  className="rounded-full border border-[var(--ui-border)] px-3 py-1 text-xs text-[var(--ui-text-muted)] hover:bg-[var(--ui-panel-soft)]"
                >
                  詳細へ
                </Link>
              </div>
              <ol className="mt-4 space-y-2 text-sm">
                {summaries.nandatte.voteTop.length > 0 ? (
                  summaries.nandatte.voteTop.map((item, index) => (
                    <li
                      key={`nandatte-vote-${item.groupId}-${index}`}
                      className="flex items-center justify-between gap-3 rounded-md"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-[var(--ui-panel)]">
                          {item.imageUrl ? (
                            <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" loading="lazy" />
                          ) : (
                            <div className="h-full w-full bg-gradient-to-br from-zinc-200 to-zinc-300 dark:from-zinc-700 dark:to-zinc-800" />
                          )}
                        </div>
                        <span className="truncate">
                          <span className="mr-2 text-xs text-[var(--ui-text-subtle)]">#{index + 1}</span>
                          {item.slug ? (
                            <Link href={`/nandatte/${item.slug}`} className="hover:underline">
                              {item.name}
                            </Link>
                          ) : (
                            item.name
                          )}
                        </span>
                      </div>
                      <span className="shrink-0 text-xs text-[var(--ui-text-muted)]">{item.voteCount}票</span>
                    </li>
                  ))
                ) : (
                  <li className="rounded-md text-xs text-[var(--ui-text-muted)]">
                    データなし
                  </li>
                )}
              </ol>
            </div>

            <div className="mb-6 break-inside-avoid rounded-xl border border-[var(--ui-border)] bg-[var(--ui-panel)] p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-500">
                    NANDATTE
                  </p>
                  <h2 className="mt-2 text-lg font-semibold">更新順</h2>
                </div>
                <Link
                  href="/nandatte"
                  className="rounded-full border border-[var(--ui-border)] px-3 py-1 text-xs text-[var(--ui-text-muted)] hover:bg-[var(--ui-panel-soft)]"
                >
                  詳細へ
                </Link>
              </div>
              <ol className="mt-4 space-y-2 text-sm">
                {summaries.nandatte.recentTop.length > 0 ? (
                  summaries.nandatte.recentTop.map((item, index) => (
                    <li
                      key={`nandatte-recent-${item.groupId}-${index}`}
                      className="flex items-center justify-between gap-3 rounded-md"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-[var(--ui-panel)]">
                          {item.imageUrl ? (
                            <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" loading="lazy" />
                          ) : (
                            <div className="h-full w-full bg-gradient-to-br from-zinc-200 to-zinc-300 dark:from-zinc-700 dark:to-zinc-800" />
                          )}
                        </div>
                        <span className="truncate">
                          <span className="mr-2 text-xs text-[var(--ui-text-subtle)]">#{index + 1}</span>
                          {item.slug ? (
                            <Link href={`/nandatte/${item.slug}`} className="hover:underline">
                              {item.name}
                            </Link>
                          ) : (
                            item.name
                          )}
                        </span>
                      </div>
                      <span className="shrink-0 text-xs text-[var(--ui-text-muted)]">
                        {formatShortDate(item.lastVoteAt)}
                      </span>
                    </li>
                  ))
                ) : (
                  <li className="rounded-md text-xs text-[var(--ui-text-muted)]">
                    データなし
                  </li>
                )}
              </ol>
            </div>

          <div className="mb-6 break-inside-avoid rounded-xl border border-[var(--ui-border)] bg-[var(--ui-panel)] p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-500">
                  BUZZTTARA
                </p>
                <h2 className="mt-2 text-lg font-semibold">最新の投稿</h2>
              </div>
              <Link
                href="/buzzttara"
                className="rounded-full border border-[var(--ui-border)] px-3 py-1 text-xs text-[var(--ui-text-muted)] hover:bg-[var(--ui-panel-soft)]"
              >
                詳細へ
              </Link>
            </div>
            <div className="mt-4 text-sm">
              {summaries.buzz.items.length > 0 ? (
                summaries.buzz.items.map((item) => (
                  <article
                    key={`buzz-${item.id}`}
                    className="break-inside-avoid rounded-lg"
                  >
                    <div className="flex items-baseline gap-3">
                      <div>
                        {item.groupSlug ? (
                          <Link
                            href={`/nandatte/${item.groupSlug}`}
                            className="text-sm text-zinc-400 underline decoration-zinc-500/80 underline-offset-4 hover:text-zinc-200"
                          >
                            {item.groupName ?? "グループ未設定"}
                          </Link>
                        ) : (
                          <p className="text-sm text-zinc-400">{item.groupName ?? "グループ未設定"}</p>
                        )}
                        <div className="mt-1 flex items-baseline gap-2">
                          <Link
                            href={`/buzzttara/tweet/${item.id}`}
                            className="text-xl font-semibold text-white underline decoration-zinc-300/80 underline-offset-4 hover:text-cyan-200"
                          >
                            {item.idolName}
                          </Link>
                          <span className="text-sm text-zinc-300">さんのバズったポスト</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-zinc-300">
                      <span className="rounded-full border border-zinc-700 px-2 py-1">
                        view {formatCount(item.viewCount)}
                      </span>
                      <span className="rounded-full border border-zinc-700 px-2 py-1">
                        いいね {formatCount(item.likeCount)}
                      </span>
                      {item.tags
                        .filter((tag) => tag.name !== "SEXY" && tag.name !== "Wow")
                        .map((tag) => (
                          <span
                            key={tag.id}
                            className="rounded-full border border-zinc-700 bg-zinc-800/40 px-2 py-1 text-zinc-200"
                          >
                            {(tag.icon ?? "") + " " + (tag.name ?? "tag")} ({formatCount(tag.likeCount)})
                          </span>
                        ))}
                    </div>

                    <div className="mt-3 overflow-hidden">
                      <SafeTweetEmbed
                        tweetId={extractTweetId(item.tweetUrl)}
                        tweetUrl={item.tweetUrl}
                        compact
                      />
                    </div>

                    <p className="mt-2 text-right text-xs text-zinc-500">
                      {formatShortDate(item.createdAt)}
                    </p>
                  </article>
                ))
              ) : (
                <div className="rounded-md text-xs text-[var(--ui-text-muted)]">
                  データを取得できませんでした。
                </div>
              )}
            </div>
          </div>
        </section>

        {!summaries.ok && summaries.error && (
          <div className="mt-6 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-700 dark:text-amber-200">
            サマリーの一部取得に失敗しました: {summaries.error}
          </div>
        )}
      </main>
    </div>
  );
}
