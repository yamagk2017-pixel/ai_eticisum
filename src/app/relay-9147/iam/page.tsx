import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const links = [
  {
    href: "/relay-9147/iam/targets",
    title: "Targets",
    description: "今週の監視対象と理由を確認",
  },
  {
    href: "/relay-9147/iam/activities",
    title: "Activities",
    description: "収集・整形済みアクティビティを時系列で確認",
  },
  {
    href: "/relay-9147/iam/candidates",
    title: "Candidates",
    description: "週刊ニュース候補とスコアを確認",
  },
];

type CandidateRow = {
  id: string;
  event_id: string;
  candidate_score: number;
  rank_hint: number | null;
};

type EventRow = {
  id: string;
  group_id: string;
  headline: string;
};

type GroupRow = {
  id: string;
  name_ja: string | null;
  slug: string | null;
};

async function getLatestWeekKey() {
  const supabase = createServerClient({ requireServiceRole: true });
  const { data, error } = await supabase
    .schema("imd")
    .from("weekly_digest_candidates")
    .select("week_key")
    .order("week_key", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.week_key ?? null;
}

async function getTopCandidates(weekKey: string) {
  const supabase = createServerClient({ requireServiceRole: true });
  const { data, error } = await supabase
    .schema("imd")
    .from("weekly_digest_candidates")
    .select("id,event_id,candidate_score,rank_hint")
    .eq("week_key", weekKey)
    .order("candidate_score", { ascending: false })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as CandidateRow[];
}

async function getEventMap(eventIds: string[]) {
  if (eventIds.length === 0) return new Map<string, EventRow>();
  const supabase = createServerClient({ requireServiceRole: true });
  const { data, error } = await supabase.schema("imd").from("normalized_events").select("id,group_id,headline").in("id", eventIds);
  if (error) throw new Error(error.message);
  return new Map(((data ?? []) as EventRow[]).map((row) => [row.id, row]));
}

async function getGroupMap(groupIds: string[]) {
  if (groupIds.length === 0) return new Map<string, GroupRow>();
  const supabase = createServerClient({ requireServiceRole: true });
  const { data, error } = await supabase.schema("imd").from("groups").select("id,name_ja,slug").in("id", groupIds);
  if (error) throw new Error(error.message);
  return new Map(((data ?? []) as GroupRow[]).map((row) => [row.id, row]));
}

async function loadTopCandidates() {
  const weekKey = await getLatestWeekKey();
  if (!weekKey) {
    return {
      weekKey: null as string | null,
      candidates: [] as CandidateRow[],
      eventMap: new Map<string, EventRow>(),
      groupMap: new Map<string, GroupRow>(),
    };
  }

  const candidates = await getTopCandidates(weekKey);
  const eventMap = await getEventMap(candidates.map((row) => row.event_id));
  const groupIds = [...new Set([...eventMap.values()].map((event) => event.group_id))];
  const groupMap = await getGroupMap(groupIds);

  return { weekKey, candidates, eventMap, groupMap };
}

export default async function IamConsoleIndexPage() {
  const { weekKey, candidates, eventMap, groupMap } = await loadTopCandidates();

  return (
    <div className="min-h-screen bg-[var(--ui-page)] text-[var(--ui-text)]">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-16">
        <header className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--ui-text-subtle)]">Relay 9147 / IAM</p>
          <h1 className="text-3xl font-semibold sm:text-4xl">IAM Console</h1>
          <p className="text-sm text-[var(--ui-text-muted)]">週次でアーカイブしたIAMデータの閲覧ページです。</p>
          <div className="flex gap-2">
            <Link href="/relay-9147" className="rounded-full border border-[var(--ui-border)] px-4 py-2 text-xs hover:border-zinc-500">
              /relay-9147
            </Link>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-2xl border border-[var(--ui-border)] bg-black/10 p-5 transition hover:border-zinc-500"
            >
              <h2 className="text-lg font-semibold">{link.title}</h2>
              <p className="mt-2 text-sm text-[var(--ui-text-muted)]">{link.description}</p>
              <p className="mt-4 text-xs text-[var(--ui-text-subtle)]">{link.href}</p>
            </Link>
          ))}
        </section>

        <section className="rounded-2xl border border-[var(--ui-border)] bg-black/10 p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">週間ニュース候補（全件）</h2>
            <Link href="/relay-9147/iam/candidates" className="text-xs text-[var(--ui-accent)] hover:underline">
              candidatesページへ
            </Link>
          </div>
          {weekKey ? (
            <p className="mt-1 text-xs text-[var(--ui-text-subtle)]">
              week_key: <span className="font-mono">{weekKey}</span> / {candidates.length}件
            </p>
          ) : null}

          {candidates.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--ui-text-muted)]">候補データはまだありません。</p>
          ) : (
            <div className="mt-4 overflow-hidden rounded-xl border border-[var(--ui-border)]">
              <table className="w-full text-left text-sm">
                <thead className="bg-black/20 text-xs uppercase tracking-wider text-[var(--ui-text-subtle)]">
                  <tr>
                    <th className="px-3 py-2">Rank</th>
                    <th className="px-3 py-2">Group</th>
                    <th className="px-3 py-2">Headline</th>
                    <th className="px-3 py-2">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {candidates.map((row, index) => {
                    const event = eventMap.get(row.event_id);
                    const group = event ? groupMap.get(event.group_id) : null;
                    return (
                      <tr key={row.id} className="border-t border-[var(--ui-border)]">
                        <td className="px-3 py-2 font-mono">{row.rank_hint ?? index + 1}</td>
                        <td className="px-3 py-2">{group?.name_ja ?? group?.slug ?? event?.group_id ?? "-"}</td>
                        <td className="px-3 py-2">{event?.headline ?? "(event not found)"}</td>
                        <td className="px-3 py-2 font-mono">{row.candidate_score}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
