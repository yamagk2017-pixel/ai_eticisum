import Link from "next/link";
import Image from "next/image";
import { createServerClient } from "@/lib/supabase/server";

type RankingRow = {
  group_id: string;
  vote_count: number;
  last_vote_at: string | null;
};

type RpcResult = {
  data: unknown[] | null;
  error: { message: string } | null;
};

type VoteRow = {
  user_id: string | null;
  group_id: string | null;
};

type GroupRow = {
  id: string;
  name_ja: string | null;
  slug: string | null;
  artist_image_url: string | null;
};

type KaiwaiItem = {
  groupId: string;
  name: string;
  slug: string | null;
  imageUrl: string | null;
  overlapUsers: number;
};

type BaseGroupSection = {
  rank: number;
  groupId: string;
  name: string;
  slug: string | null;
  imageUrl: string | null;
  voteCount: number;
  kaiwai: KaiwaiItem[];
};

async function callVoteTop(limit: number): Promise<RankingRow[]> {
  const supabase = createServerClient({ requireServiceRole: true });
  const names = ["get_vote_top20", "get_vote_top10", "get_vote_top5"];
  const paramsList: Array<Record<string, unknown> | undefined> = [
    { p_limit: limit },
    { limit },
    { p_top: limit },
    undefined,
  ];

  let lastError: string | null = null;

  for (const name of names) {
    for (const params of paramsList) {
      const res = (params
        ? await supabase.schema("nandatte").rpc(name, params)
        : await supabase.schema("nandatte").rpc(name)) as RpcResult;

      if (!res.error) {
        return ((res.data ?? []) as RankingRow[]).slice(0, limit);
      }
      lastError = res.error.message;
    }
  }

  throw new Error(lastError ?? "NANDATTE vote ranking RPC unavailable");
}

function sortKaiwai(a: KaiwaiItem, b: KaiwaiItem) {
  if (b.overlapUsers !== a.overlapUsers) {
    return b.overlapUsers - a.overlapUsers;
  }
  return a.name.localeCompare(b.name, "ja");
}

async function loadKaiwaiSections(): Promise<BaseGroupSection[]> {
  const voteTop = await callVoteTop(10);
  const baseGroupIds = voteTop.map((row) => row.group_id);
  if (baseGroupIds.length === 0) return [];

  const supabase = createServerClient({ requireServiceRole: true });
  const baseVotesRes = await supabase
    .schema("nandatte")
    .from("votes")
    .select("user_id,group_id")
    .in("group_id", baseGroupIds);

  if (baseVotesRes.error) {
    throw new Error(baseVotesRes.error.message);
  }

  const baseVotes = (baseVotesRes.data ?? []) as VoteRow[];
  const baseUserIds = Array.from(
    new Set(baseVotes.map((row) => row.user_id).filter((id): id is string => typeof id === "string" && id.length > 0))
  );

  if (baseUserIds.length === 0) {
    return voteTop.map((row, index) => ({
      rank: index + 1,
      groupId: row.group_id,
      name: row.group_id,
      slug: null,
      imageUrl: null,
      voteCount: row.vote_count,
      kaiwai: [],
    }));
  }

  const allVotesRes = await supabase
    .schema("nandatte")
    .from("votes")
    .select("user_id,group_id")
    .in("user_id", baseUserIds);

  if (allVotesRes.error) {
    throw new Error(allVotesRes.error.message);
  }

  const allVotes = (allVotesRes.data ?? []) as VoteRow[];
  const userGroups = new Map<string, Set<string>>();
  for (const row of allVotes) {
    if (!row.user_id || !row.group_id) continue;
    const list = userGroups.get(row.user_id) ?? new Set<string>();
    list.add(row.group_id);
    userGroups.set(row.user_id, list);
  }

  const baseUsersByGroup = new Map<string, Set<string>>();
  for (const row of baseVotes) {
    if (!row.user_id || !row.group_id) continue;
    const list = baseUsersByGroup.get(row.group_id) ?? new Set<string>();
    list.add(row.user_id);
    baseUsersByGroup.set(row.group_id, list);
  }

  const allGroupIds = Array.from(
    new Set(allVotes.map((row) => row.group_id).filter((id): id is string => typeof id === "string" && id.length > 0))
  );
  const groupIdsForMeta = Array.from(new Set([...baseGroupIds, ...allGroupIds]));

  let groups: GroupRow[] = [];
  if (groupIdsForMeta.length > 0) {
    const groupsRes = await supabase
      .schema("imd")
      .from("groups")
      .select("id,name_ja,slug,artist_image_url")
      .in("id", groupIdsForMeta);
    if (!groupsRes.error) {
      groups = (groupsRes.data ?? []) as GroupRow[];
    }
  }

  const groupMap = new Map(groups.map((group) => [group.id, group]));
  return voteTop.map((row, index) => {
    const baseUsers = baseUsersByGroup.get(row.group_id) ?? new Set<string>();
    const overlapMap = new Map<string, number>();

    for (const userId of baseUsers) {
      const votedGroups = userGroups.get(userId);
      if (!votedGroups) continue;
      for (const groupId of votedGroups) {
        if (groupId === row.group_id) continue;
        overlapMap.set(groupId, (overlapMap.get(groupId) ?? 0) + 1);
      }
    }

    const kaiwai: KaiwaiItem[] = Array.from(overlapMap.entries())
      .filter(([, overlapUsers]) => overlapUsers > 0)
      .map(([groupId, overlapUsers]) => {
        const group = groupMap.get(groupId);
        return {
          groupId,
          name: group?.name_ja ?? groupId,
          slug: group?.slug ?? null,
          imageUrl: group?.artist_image_url ?? null,
          overlapUsers,
        };
      })
      .sort(sortKaiwai)
      .slice(0, 10);

    const baseGroup = groupMap.get(row.group_id);
    return {
      rank: index + 1,
      groupId: row.group_id,
      name: baseGroup?.name_ja ?? row.group_id,
      slug: baseGroup?.slug ?? null,
      imageUrl: baseGroup?.artist_image_url ?? null,
      voteCount: row.vote_count,
      kaiwai,
    };
  });
}

export default async function KaiwaiPage() {
  let sections: BaseGroupSection[] = [];
  let errorMessage: string | null = null;

  try {
    sections = await loadKaiwaiSections();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    errorMessage =
      message === "Missing SUPABASE_SERVICE_ROLE_KEY"
        ? "SUPABASE_SERVICE_ROLE_KEY が未設定です。/kaiwai は集計のためサービスロールキーが必要です。"
        : message === "SUPABASE_SERVICE_ROLE_KEY is publishable key"
        ? "SUPABASE_SERVICE_ROLE_KEY に publishable key が入っています。service_role か secret key を設定してください。"
        : message === "SUPABASE_SERVICE_ROLE_KEY role is not service_role"
        ? "SUPABASE_SERVICE_ROLE_KEY に service_role 以外のJWTキーが入っています。service_role を設定してください。"
        : message;
  }

  return (
    <div className="min-h-screen bg-[var(--ui-page)] text-[var(--ui-text)]">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-16 sm:px-12">
        <header className="space-y-3">
          <p className="text-xs font-semibold text-[var(--ui-text-subtle)]">Prototype (unlisted)</p>
          <h1 className="font-mincho-jp text-3xl font-semibold leading-tight sm:text-5xl">カイワイ</h1>
          <p className="max-w-4xl text-sm text-[var(--ui-text-muted)] sm:text-base">
            ナンダッテ投票ランキングTOP10を基準に、「同じユーザーにあわせて投票されやすいグループ」を表示します。
          </p>
        </header>

        {errorMessage ? (
          <div className="p-1 text-sm text-red-200">
            読み込みに失敗しました: {errorMessage}
          </div>
        ) : null}

        {!errorMessage && sections.length === 0 ? (
          <div className="p-1 text-sm text-[var(--ui-text-muted)]">
            ランキングデータがありません。
          </div>
        ) : null}

        {!errorMessage && sections.length > 0 ? (
          <div className="grid gap-4">
            {sections.map((section) => (
              <section key={section.groupId} className="py-3 sm:py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-md bg-zinc-800/60">
                      <div className="absolute inset-0 grid place-items-center text-[10px] text-zinc-300">
                        {section.name.slice(0, 1)}
                      </div>
                      {section.imageUrl ? (
                        <Image
                          src={section.imageUrl}
                          alt={section.name}
                          fill
                          sizes="36px"
                          className="relative object-cover"
                          unoptimized
                        />
                      ) : null}
                    </div>
                    <h2 className="min-w-0 truncate font-mincho-jp text-2xl font-semibold sm:text-3xl">
                      {section.slug ? (
                        <Link
                          className="underline decoration-[var(--ui-text-subtle)] underline-offset-2 hover:text-[var(--ui-link)]"
                          href={`/nandatte/${section.slug}`}
                        >
                          {section.name}
                        </Link>
                      ) : (
                        section.name
                      )}
                      のカイワイ
                    </h2>
                  </div>
                  <p className="text-xs text-[var(--ui-text-subtle)]">投票数: {section.voteCount}</p>
                </div>

                {section.kaiwai.length === 0 ? (
                  <p className="mt-4 text-sm text-[var(--ui-text-muted)]">重なりはありません</p>
                ) : (
                  <ol className="mt-4 grid gap-2 rounded-xl border border-[var(--ui-border)] p-3 text-sm sm:grid-cols-2">
                    {section.kaiwai.map((item) => (
                      <li key={`${section.groupId}-${item.groupId}`} className="px-1 py-1">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-2">
                            <div className="relative h-7 w-7 shrink-0 overflow-hidden rounded bg-zinc-800/60">
                              <div className="absolute inset-0 grid place-items-center text-[10px] text-zinc-300">
                                {item.name.slice(0, 1)}
                              </div>
                              {item.imageUrl ? (
                                <Image
                                  src={item.imageUrl}
                                  alt={item.name}
                                  fill
                                  sizes="28px"
                                  className="relative object-cover"
                                  unoptimized
                                />
                              ) : null}
                            </div>
                            <div className="min-w-0 truncate">
                              {item.slug ? (
                                <Link
                                  className="text-base font-medium underline decoration-[var(--ui-text-subtle)] underline-offset-2 hover:text-[var(--ui-link)] sm:text-lg"
                                  href={`/nandatte/${item.slug}`}
                                >
                                  {item.name}
                                </Link>
                              ) : (
                                <span className="text-base font-medium sm:text-lg">{item.name}</span>
                              )}
                            </div>
                          </div>
                          <span className="shrink-0 text-xs text-[var(--ui-text-subtle)]">{item.overlapUsers}人</span>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            ))}
          </div>
        ) : null}
      </main>
    </div>
  );
}
