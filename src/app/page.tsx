import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type AppCard = {
  name: string;
  href: string;
  label: string;
  description: string;
  accent: string;
  status: string;
  cta: string;
};

const appCards: AppCard[] = [
  {
    name: "NANDATTE",
    href: "/nandatte",
    label: "みんなに思われてるよ、を可視化",
    description:
      "投票データからアイドルグループの魅力と文脈を見える化するランキング。個別ページやマイ投票も含めた中核機能。",
    accent: "from-emerald-400/25 via-lime-300/10 to-transparent",
    status: "稼働中",
    cta: "ランキングを見る",
  },
  {
    name: "IMAKITE",
    href: "/imakite",
    label: "いま来てるアイドルの勢いを確認",
    description:
      "日次/週次ランキングの閲覧とアーカイブ導線を提供。直近の盛り上がりを追うための時系列ハブ。",
    accent: "from-amber-400/30 via-orange-300/10 to-transparent",
    status: "稼働中",
    cta: "最新ランキングへ",
  },
  {
    name: "BUZZTTARA",
    href: "/buzzttara",
    label: "SNSで話題化した投稿を追跡",
    description:
      "アイドル界隈のバズ投稿を集約し、時系列で確認できるタイムライン。個別投稿ページへの導線も提供。",
    accent: "from-cyan-400/25 via-sky-300/10 to-transparent",
    status: "稼働中",
    cta: "バズ一覧を見る",
  },
  {
    name: "Relay 9147",
    href: "/relay-9147",
    label: "運用コンソール",
    description:
      "IMAKITE / BUZZTTARA の管理操作を一画面で扱う内部向けコントロールサーフェス。",
    accent: "from-fuchsia-400/20 via-violet-300/10 to-transparent",
    status: "運用用",
    cta: "コンソールを開く",
  },
];

const quickLinks = [
  { href: "/imakite/archive", title: "IMAKITE Archive", desc: "日次ランキングの履歴を見る" },
  { href: "/imakite/weekly", title: "IMAKITE Weekly", desc: "週次ランキングの最新一覧" },
  { href: "/nandatte/me", title: "NANDATTE My Votes", desc: "自分の投票履歴を確認" },
];

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
  groupId: string | null;
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
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }
  return null;
}

function pickNumber(row: RowRecord, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
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
  return new Intl.DateTimeFormat("ja-JP", {
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ts));
}

async function getHomeSummaries() {
  try {
    const supabase = createServerClient();

    const imakitePromise = (async () => {
      const latest = await supabase
        .schema("ihc")
        .from("daily_top20")
        .select("snapshot_date")
        .order("snapshot_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latest.error) {
        throw new Error(`IMAKITE latest date: ${latest.error.message}`);
      }

      const latestDate = (latest.data as { snapshot_date?: string } | null)?.snapshot_date ?? null;
      if (!latestDate) {
        return { latestDate: null, items: [] as ImakiteSummaryItem[] };
      }

      const rowsRes = await supabase
        .schema("ihc")
        .from("daily_top20")
        .select("*")
        .eq("snapshot_date", latestDate)
        .order("rank", { ascending: true })
        .limit(5);

      if (rowsRes.error) {
        throw new Error(`IMAKITE rows: ${rowsRes.error.message}`);
      }

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
    })();

    const nandattePromise = (async () => {
      const [voteRes, recentRes] = await Promise.all([
        supabase.schema("nandatte").rpc("get_vote_top5"),
        supabase.schema("nandatte").rpc("get_recent_vote_top5"),
      ]);

      if (voteRes.error || recentRes.error) {
        throw new Error(voteRes.error?.message ?? recentRes.error?.message ?? "NANDATTE RPC error");
      }

      const voteRows = ((voteRes.data ?? []) as unknown[]).map((row) => asRecord(row));
      const recentRows = ((recentRes.data ?? []) as unknown[]).map((row) => asRecord(row));
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
    })();

    const buzzPromise = (async () => {
      const tweetsRes = await supabase
        .from("tweets")
        .select("id,idol_name,group_id,created_at,like_count")
        .order("created_at", { ascending: false })
        .limit(3);

      if (tweetsRes.error) {
        throw new Error(`BUZZTTARA tweets: ${tweetsRes.error.message}`);
      }

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

      const items: BuzzSummaryItem[] = rows.map((row) => ({
        id: row.id,
        idolName: row.idol_name ?? "-",
        groupId: row.group_id,
        groupName: row.group_id ? groupMap.get(row.group_id) ?? null : null,
        createdAt: row.created_at,
        likeCount: row.like_count,
      }));

      return { items };
    })();

    const [imakite, nandatte, buzz] = await Promise.all([
      imakitePromise,
      nandattePromise,
      buzzPromise,
    ]);

    return {
      ok: true as const,
      imakite,
      nandatte,
      buzz,
      error: null,
    };
  } catch (error) {
    return {
      ok: false as const,
      imakite: { latestDate: null, items: [] as ImakiteSummaryItem[] },
      nandatte: { voteTop: [] as NandatteSummaryItem[], recentTop: [] as NandatteSummaryItem[] },
      buzz: { items: [] as BuzzSummaryItem[] },
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export default async function Home() {
  const summaries = await getHomeSummaries();

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#1f29371a_0%,_transparent_55%),var(--ui-page)] text-[var(--ui-text)]">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 py-10 sm:py-14">
        <header className="relative overflow-hidden rounded-3xl border border-[var(--ui-border)] bg-[var(--ui-panel)] p-6 shadow-sm sm:p-8">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-r from-emerald-400/10 via-amber-300/8 to-cyan-400/10" />
          <div className="relative flex flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[var(--ui-text-subtle)]">
                Musicite Portal
              </p>
              <ThemeToggle />
            </div>

            <div className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
              <div className="flex flex-col gap-4">
                <h1 className="font-mincho-jp text-3xl leading-tight sm:text-5xl">
                  アイドル情報を横断して見にいくための入口
                </h1>
                <p className="max-w-3xl text-sm leading-7 text-[var(--ui-text-muted)] sm:text-base">
                  ランキング、投票文脈、SNSのバズ、運用コンソールをまとめて扱うためのポータルです。
                  いま見るべきものに最短で入れるように、各ページの役割ごとに導線を整理しています。
                </p>
                <div className="flex flex-wrap gap-3">
                  <Link
                    href="/imakite"
                    className="rounded-full bg-[var(--ui-accent)] px-4 py-2 text-sm font-semibold text-[var(--ui-accent-contrast)]"
                  >
                    まずは IMAKITE を見る
                  </Link>
                  <Link
                    href="/nandatte"
                    className="rounded-full border border-[var(--ui-border)] bg-[var(--ui-panel-soft)] px-4 py-2 text-sm text-[var(--ui-text)] hover:bg-[var(--ui-panel)]"
                  >
                    NANDATTE へ
                  </Link>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                <div className="rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-panel-soft)] p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-[var(--ui-text-subtle)]">Apps</p>
                  <p className="mt-2 text-2xl font-semibold">{appCards.length}</p>
                  <p className="mt-1 text-xs text-[var(--ui-text-muted)]">公開 + 運用画面の導線</p>
                </div>
                <div className="rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-panel-soft)] p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-[var(--ui-text-subtle)]">Focus</p>
                  <p className="mt-2 text-sm font-semibold">発見 / 文脈 / 拡散</p>
                  <p className="mt-1 text-xs text-[var(--ui-text-muted)]">見る順番を分けて設計</p>
                </div>
                <div className="rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-panel-soft)] p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-[var(--ui-text-subtle)]">Mode</p>
                  <p className="mt-2 text-sm font-semibold">Portal Home</p>
                  <p className="mt-1 text-xs text-[var(--ui-text-muted)]">全体導線と状況把握</p>
                </div>
              </div>
            </div>
          </div>
        </header>

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
              <p className="mt-2 text-xs text-[var(--ui-text-subtle)]">
                {summaries.imakite.latestDate} 時点
              </p>
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
                        <span className="shrink-0 text-xs text-[var(--ui-text-muted)]">
                          {item.voteCount}票
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

        {!summaries.ok && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-700 dark:text-amber-200">
            サマリーの一部取得に失敗しました: {summaries.error}
          </div>
        )}

        <section className="grid gap-5 md:grid-cols-2">
          {appCards.map((app) => (
            <Link
              key={app.href}
              href={app.href}
              className="group relative overflow-hidden rounded-3xl border border-[var(--ui-border)] bg-[var(--ui-panel)] p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--ui-text-subtle)]"
            >
              <div className={`absolute inset-x-0 top-0 h-20 bg-gradient-to-r ${app.accent}`} />
              <div className="relative flex h-full flex-col gap-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--ui-text-subtle)]">
                      {app.name}
                    </p>
                    <h2 className="mt-2 text-xl font-semibold leading-tight">{app.label}</h2>
                  </div>
                  <span className="rounded-full border border-[var(--ui-border)] bg-[var(--ui-panel-soft)] px-3 py-1 text-[11px] text-[var(--ui-text-muted)]">
                    {app.status}
                  </span>
                </div>

                <p className="text-sm leading-6 text-[var(--ui-text-muted)]">{app.description}</p>

                <div className="mt-auto flex items-center justify-between gap-3 pt-2">
                  <span className="text-xs text-[var(--ui-text-subtle)]">{app.href}</span>
                  <span className="text-sm font-medium text-[var(--ui-text)] transition group-hover:translate-x-1">
                    {app.cta} →
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-[var(--ui-border)] bg-[var(--ui-panel)] p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-semibold">クイック導線</h2>
              <span className="text-xs text-[var(--ui-text-subtle)]">よく使うページ</span>
            </div>
            <div className="mt-4 grid gap-3">
              {quickLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-panel-soft)] px-4 py-3 transition hover:bg-[var(--ui-panel)]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium">{item.title}</p>
                    <span className="text-xs text-[var(--ui-text-subtle)]">{item.href}</span>
                  </div>
                  <p className="mt-1 text-xs text-[var(--ui-text-muted)]">{item.desc}</p>
                </Link>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-[var(--ui-border)] bg-[var(--ui-panel)] p-6 shadow-sm">
            <h2 className="text-lg font-semibold">このポータルでやること</h2>
            <ol className="mt-4 space-y-4 text-sm text-[var(--ui-text-muted)]">
              <li className="rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-panel-soft)] p-4">
                <p className="font-medium text-[var(--ui-text)]">1. いま勢いのある対象を把握する</p>
                <p className="mt-1">`IMAKITE` で日次・週次のランキングを確認。</p>
              </li>
              <li className="rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-panel-soft)] p-4">
                <p className="font-medium text-[var(--ui-text)]">2. 文脈と評価軸を深掘る</p>
                <p className="mt-1">`NANDATTE` で投票理由や魅力の見え方を確認。</p>
              </li>
              <li className="rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-panel-soft)] p-4">
                <p className="font-medium text-[var(--ui-text)]">3. 拡散の兆しを追う</p>
                <p className="mt-1">`BUZZTTARA` でSNS上の話題化タイムラインを確認。</p>
              </li>
            </ol>
          </div>
        </section>
      </main>
    </div>
  );
}
