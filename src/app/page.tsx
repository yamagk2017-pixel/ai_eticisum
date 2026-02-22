import Link from "next/link";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type RowRecord = Record<string, unknown>;

type ImakiteSummaryItem = {
  rank: number;
  name: string;
  point: number;
};

type NandatteSummaryItem = {
  groupId: string;
  name: string;
  slug: string | null;
  voteCount: number;
  lastVoteAt: string | null;
};

type BuzzSummaryItem = {
  id: string;
  idolName: string;
  groupName: string | null;
  createdAt: string | null;
  likeCount: number | null;
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

async function getHomeSummaries() {
  const fallback = {
    imakite: { latestDate: null, items: [] as ImakiteSummaryItem[] },
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

        const items = ((rowsRes.data ?? []) as unknown[])
          .map((row) => {
            const r = asRecord(row);
            return {
              rank: pickNumber(r, ["rank"]) ?? 0,
              name: pickString(r, ["artist_name", "group_name"]) ?? "-",
              point: pickNumber(r, ["total_score", "score", "weekly_score"]) ?? 0,
            };
          })
          .filter((row) => row.rank > 0)
          .sort((a, b) => a.rank - b.rank)
          .slice(0, 5);

        return { latestDate, items };
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

        const groupMap = new Map<string, { name: string; slug: string | null }>();
        if (groupIds.length > 0) {
          const groupsRes = await supabase
            .schema("imd")
            .from("groups")
            .select("id,name_ja,slug")
            .in("id", groupIds);
          if (!groupsRes.error) {
            for (const row of (groupsRes.data ?? []) as Array<{
              id: string;
              name_ja: string | null;
              slug: string | null;
            }>) {
              groupMap.set(row.id, { name: row.name_ja ?? row.id, slug: row.slug ?? null });
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
          .select("id,idol_name,group_id,created_at,like_count")
          .order("created_at", { ascending: false })
          .limit(3);
        if (tweetsRes.error) throw new Error(`BUZZTTARA tweets: ${tweetsRes.error.message}`);

        const rows = ((tweetsRes.data ?? []) as Array<{
          id: string;
          idol_name: string | null;
          group_id: string | null;
          created_at: string | null;
          like_count: number | null;
        }>).filter((row) => !!row.id && !!row.idol_name);

        const groupIds = Array.from(
          new Set(rows.map((row) => row.group_id).filter((id): id is string => !!id))
        );
        const groupMap = new Map<string, string>();
        if (groupIds.length > 0) {
          const groupsRes = await supabase
            .schema("imd")
            .from("groups")
            .select("id,name_ja")
            .in("id", groupIds);
          if (!groupsRes.error) {
            for (const row of (groupsRes.data ?? []) as Array<{ id: string; name_ja: string | null }>) {
              groupMap.set(row.id, row.name_ja ?? row.id);
            }
          }
        }

        return {
          items: rows.map((row) => ({
            id: row.id,
            idolName: row.idol_name ?? "-",
            groupName: row.group_id ? groupMap.get(row.group_id) ?? null : null,
            createdAt: row.created_at,
            likeCount: row.like_count,
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

  return (
    <div className="min-h-screen bg-[var(--ui-page)] text-[var(--ui-text)]">
      <main className="mx-auto w-full max-w-6xl px-6 py-10 sm:py-14">
        <section className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-3xl border border-[var(--ui-border)] bg-[var(--ui-panel)] p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-500">
                  IMAKITE Summary
                </p>
                <h2 className="mt-2 text-lg font-semibold">最新ランキング TOP5</h2>
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
            <ol className="mt-4 space-y-2 text-sm">
              {summaries.imakite.items.length > 0 ? (
                summaries.imakite.items.map((item) => (
                  <li
                    key={`imakite-${item.rank}-${item.name}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-panel-soft)] px-3 py-2"
                  >
                    <span className="truncate">
                      <span className="mr-2 text-xs text-[var(--ui-text-subtle)]">#{item.rank}</span>
                      {item.name}
                    </span>
                    <span className="shrink-0 text-xs font-medium text-[var(--ui-text-muted)]">
                      {formatPoint(item.point)} pt
                    </span>
                  </li>
                ))
              ) : (
                <li className="rounded-xl border border-[var(--ui-border)] bg-[var(--ui-panel-soft)] px-3 py-3 text-xs text-[var(--ui-text-muted)]">
                  データを取得できませんでした。
                </li>
              )}
            </ol>
          </div>

          <div className="rounded-3xl border border-[var(--ui-border)] bg-[var(--ui-panel)] p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-500">
                  NANDATTE Summary
                </p>
                <h2 className="mt-2 text-lg font-semibold">投票 / 更新 TOP3</h2>
              </div>
              <Link
                href="/nandatte"
                className="rounded-full border border-[var(--ui-border)] px-3 py-1 text-xs text-[var(--ui-text-muted)] hover:bg-[var(--ui-panel-soft)]"
              >
                詳細へ
              </Link>
            </div>
            <div className="mt-4 grid gap-4">
              <div>
                <p className="mb-2 text-xs font-medium text-[var(--ui-text-subtle)]">投票ランキング</p>
                <ol className="space-y-2 text-sm">
                  {summaries.nandatte.voteTop.length > 0 ? (
                    summaries.nandatte.voteTop.map((item, index) => (
                      <li
                        key={`nandatte-vote-${item.groupId}-${index}`}
                        className="flex items-center justify-between gap-3 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-panel-soft)] px-3 py-2"
                      >
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
                        <span className="shrink-0 text-xs text-[var(--ui-text-muted)]">{item.voteCount}票</span>
                      </li>
                    ))
                  ) : (
                    <li className="rounded-xl border border-[var(--ui-border)] bg-[var(--ui-panel-soft)] px-3 py-3 text-xs text-[var(--ui-text-muted)]">
                      データなし
                    </li>
                  )}
                </ol>
              </div>

              <div>
                <p className="mb-2 text-xs font-medium text-[var(--ui-text-subtle)]">更新TOP3</p>
                <ol className="space-y-2 text-sm">
                  {summaries.nandatte.recentTop.length > 0 ? (
                    summaries.nandatte.recentTop.map((item, index) => (
                      <li
                        key={`nandatte-recent-${item.groupId}-${index}`}
                        className="flex items-center justify-between gap-3 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-panel-soft)] px-3 py-2"
                      >
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
                        <span className="shrink-0 text-xs text-[var(--ui-text-muted)]">
                          {formatShortDate(item.lastVoteAt)}
                        </span>
                      </li>
                    ))
                  ) : (
                    <li className="rounded-xl border border-[var(--ui-border)] bg-[var(--ui-panel-soft)] px-3 py-3 text-xs text-[var(--ui-text-muted)]">
                      データなし
                    </li>
                  )}
                </ol>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-[var(--ui-border)] bg-[var(--ui-panel)] p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-500">
                  BUZZTTARA Summary
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
            <ol className="mt-4 space-y-3 text-sm">
              {summaries.buzz.items.length > 0 ? (
                summaries.buzz.items.map((item) => (
                  <li
                    key={`buzz-${item.id}`}
                    className="rounded-xl border border-[var(--ui-border)] bg-[var(--ui-panel-soft)] p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <Link href={`/buzzttara/tweet/${item.id}`} className="font-medium hover:underline">
                        {item.idolName}
                      </Link>
                      <span className="text-xs text-[var(--ui-text-subtle)]">
                        {formatShortDate(item.createdAt)}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--ui-text-muted)]">
                      <span>{item.groupName ?? "グループ未設定"}</span>
                      <span>いいね {item.likeCount ?? "-"}</span>
                    </div>
                  </li>
                ))
              ) : (
                <li className="rounded-xl border border-[var(--ui-border)] bg-[var(--ui-panel-soft)] px-3 py-3 text-xs text-[var(--ui-text-muted)]">
                  データを取得できませんでした。
                </li>
              )}
            </ol>
          </div>
        </section>

        {!summaries.ok && summaries.error && (
          <div className="mt-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-700 dark:text-amber-200">
            サマリーの一部取得に失敗しました: {summaries.error}
          </div>
        )}
      </main>
    </div>
  );
}
