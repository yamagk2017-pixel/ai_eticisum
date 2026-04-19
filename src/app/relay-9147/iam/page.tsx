import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type CandidateRow = {
  id: string;
  week_key: string;
  event_id: string;
  candidate_score: number;
  rank_hint: number | null;
  editorial_note: string | null;
  status: "adopt" | "hold" | "drop";
  created_at: string;
};

type EventRow = {
  id: string;
  group_id: string;
  headline: string;
  summary: string | null;
  confidence: number | null;
  event_type: string;
};

type GroupRow = {
  id: string;
  name_ja: string | null;
  slug: string | null;
};

type ComplementRow = {
  group_id: string;
  status: "completed" | "budget_limited" | "error" | "skipped";
  summary: string | null;
  bullets: string[] | null;
  major_ongoing_topics: string[] | null;
  sources: string[] | null;
};

type CandidatesData = {
  weekKey: string | null;
  candidates: CandidateRow[];
  eventMap: Map<string, EventRow>;
  groupMap: Map<string, GroupRow>;
  complementMap: Map<string, ComplementRow>;
  eventSourceUrlMap: Map<string, string>;
  error: string | null;
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

async function getCandidates(weekKey: string) {
  const supabase = createServerClient({ requireServiceRole: true });
  const { data, error } = await supabase
    .schema("imd")
    .from("weekly_digest_candidates")
    .select("id,week_key,event_id,candidate_score,rank_hint,editorial_note,status,created_at")
    .eq("week_key", weekKey)
    .order("candidate_score", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as CandidateRow[];
}

async function getEventMap(eventIds: string[]) {
  if (eventIds.length === 0) return new Map<string, EventRow>();
  const supabase = createServerClient({ requireServiceRole: true });
  const { data, error } = await supabase
    .schema("imd")
    .from("normalized_events")
    .select("id,group_id,headline,summary,confidence,event_type")
    .in("id", eventIds);

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

async function getComplementMap(weekKey: string, groupIds: string[]) {
  if (groupIds.length === 0) return new Map<string, ComplementRow>();
  const supabase = createServerClient({ requireServiceRole: true });
  const { data, error } = await supabase
    .schema("imd")
    .from("weekly_group_complements")
    .select("group_id,status,summary,bullets,major_ongoing_topics,sources")
    .eq("week_key", weekKey)
    .in("group_id", groupIds);

  if (error) throw new Error(error.message);
  return new Map(((data ?? []) as ComplementRow[]).map((row) => [row.group_id, row]));
}

async function getEventSourceUrlMap(eventIds: string[]) {
  if (eventIds.length === 0) return new Map<string, string>();
  const supabase = createServerClient({ requireServiceRole: true });
  const { data, error } = await supabase
    .schema("imd")
    .from("event_sources")
    .select("event_id,raw_updates!inner(source_url,source_type)")
    .in("event_id", eventIds);

  if (error) throw new Error(error.message);

  const map = new Map<string, string>();
  const rows = (data ?? []) as Array<{
    event_id: string;
    raw_updates: { source_url?: string | null; source_type?: string | null } | Array<{ source_url?: string | null; source_type?: string | null }>;
  }>;

  for (const row of rows) {
    const raws = Array.isArray(row.raw_updates) ? row.raw_updates : [row.raw_updates];
    const preferred = raws.find((raw) => raw?.source_type === "youtube" || raw?.source_type === "spotify_release");
    const fallback = raws.find((raw) => typeof raw?.source_url === "string" && raw.source_url.length > 0);
    const selected = preferred?.source_url ?? fallback?.source_url ?? null;
    if (selected && !map.has(row.event_id)) {
      map.set(row.event_id, selected);
    }
  }

  return map;
}

async function loadCandidatesData(): Promise<CandidatesData> {
  try {
    const weekKey = await getLatestWeekKey();
    if (!weekKey) {
      return {
        weekKey: null,
        candidates: [],
        eventMap: new Map<string, EventRow>(),
        groupMap: new Map<string, GroupRow>(),
        complementMap: new Map<string, ComplementRow>(),
        eventSourceUrlMap: new Map<string, string>(),
        error: null,
      };
    }

    const candidates = await getCandidates(weekKey);
    const eventMap = await getEventMap(candidates.map((row) => row.event_id));
    const groupIds = [...new Set([...eventMap.values()].map((row) => row.group_id))];
    const [groupMap, complementMap, eventSourceUrlMap] = await Promise.all([
      getGroupMap(groupIds),
      getComplementMap(weekKey, groupIds),
      getEventSourceUrlMap(candidates.map((row) => row.event_id)),
    ]);

    return { weekKey, candidates, eventMap, groupMap, complementMap, eventSourceUrlMap, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      weekKey: null,
      candidates: [],
      eventMap: new Map<string, EventRow>(),
      groupMap: new Map<string, GroupRow>(),
      complementMap: new Map<string, ComplementRow>(),
      eventSourceUrlMap: new Map<string, string>(),
      error: message,
    };
  }
}

export default async function IamConsolePage() {
  const { weekKey, candidates, eventMap, groupMap, complementMap, eventSourceUrlMap, error } = await loadCandidatesData();

  if (error) {
    return (
      <div className="min-h-screen bg-[var(--ui-page)] px-6 py-12 text-[var(--ui-text)]">
        <div className="mx-auto max-w-5xl rounded-2xl border border-red-500/40 bg-red-500/10 p-6">
          <p className="text-sm">Failed to load candidates: {error}</p>
          <Link href="/relay-9147" className="mt-3 inline-block text-sm text-[var(--ui-accent)]">
            /relay-9147 へ戻る
          </Link>
        </div>
      </div>
    );
  }

  if (!weekKey) {
    return (
      <div className="min-h-screen bg-[var(--ui-page)] px-6 py-12 text-[var(--ui-text)]">
        <div className="mx-auto max-w-5xl rounded-2xl border border-[var(--ui-border)] p-6">
          <p className="text-sm text-[var(--ui-text-muted)]">weekly_digest_candidates はまだ空です。</p>
          <Link href="/relay-9147" className="mt-3 inline-block text-sm text-[var(--ui-accent)]">
            /relay-9147 へ戻る
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--ui-page)] px-6 py-12 text-[var(--ui-text)]">
      <main className="mx-auto max-w-6xl space-y-6">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--ui-text-subtle)]">Relay 9147 / IAM</p>
          <h1 className="text-2xl font-semibold">週刊ニュース候補</h1>
          <p className="text-sm text-[var(--ui-text-muted)]">
            week_key: <span className="font-mono">{weekKey}</span> / {candidates.length}件
          </p>
          <Link href="/relay-9147" className="inline-block text-sm text-[var(--ui-accent)]">
            /relay-9147 へ戻る
          </Link>
        </header>

        <div className="overflow-hidden rounded-2xl border border-[var(--ui-border)]">
          <table className="w-full text-left text-sm">
            <thead className="bg-black/20 text-xs uppercase tracking-wider text-[var(--ui-text-subtle)]">
              <tr>
                <th className="px-4 py-3">Rank</th>
                <th className="px-4 py-3">Group</th>
                <th className="px-4 py-3">Headline</th>
                <th className="px-4 py-3">Score</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Confidence</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((row, index) => {
                const event = eventMap.get(row.event_id);
                const group = event ? groupMap.get(event.group_id) : undefined;
                const complement = event ? complementMap.get(event.group_id) : undefined;
                const complementSummary =
                  complement?.status === "budget_limited"
                    ? "利用限度（料金）の上限に達しました"
                    : complement?.summary ?? null;
                const complementBullets = complement?.status === "completed" ? (complement.bullets ?? []) : [];
                const majorTopics = complement?.status === "completed" ? (complement.major_ongoing_topics ?? []) : [];
                const complementSources = complement?.status === "completed" ? (complement.sources ?? []) : [];
                const eventSourceUrl = event ? eventSourceUrlMap.get(event.id) : null;
                const groupDetailHref = group?.slug ? `/nandatte/${group.slug}` : null;
                return (
                  <tr key={row.id} className="border-t border-[var(--ui-border)] align-top">
                    <td className="px-4 py-3 font-mono">{row.rank_hint ?? index + 1}</td>
                    <td className="px-4 py-3">
                      {groupDetailHref ? (
                        <Link href={groupDetailHref} className="text-[var(--ui-accent)] hover:underline">
                          {group?.name_ja ?? event?.group_id ?? "-"}
                        </Link>
                      ) : (
                        <p>{group?.name_ja ?? event?.group_id ?? "-"}</p>
                      )}
                      <p className="text-xs text-[var(--ui-text-subtle)]">{group?.slug ?? "-"}</p>
                    </td>
                    <td className="px-4 py-3">
                      {eventSourceUrl ? (
                        <a
                          href={eventSourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-[var(--ui-accent)] hover:underline"
                        >
                          {event?.headline ?? "(event not found)"}
                        </a>
                      ) : (
                        <p className="font-medium">{event?.headline ?? "(event not found)"}</p>
                      )}
                      <p className="mt-1 text-xs text-[var(--ui-text-muted)]">{event?.summary ?? row.editorial_note ?? "-"}</p>
                      {complementSummary ? (
                        <p className="mt-2 text-xs text-[var(--ui-accent)]">AI補足: {complementSummary}</p>
                      ) : null}
                      {complementBullets.length > 0 ? (
                        <p className="mt-1 text-xs text-[var(--ui-text-muted)]">
                          補足ポイント: {complementBullets.join(" / ")}
                        </p>
                      ) : null}
                      {majorTopics.length > 0 ? (
                        <p className="mt-1 text-xs text-[var(--ui-text)]">継続重要: {majorTopics.join(" / ")}</p>
                      ) : null}
                      {complementSources.length > 0 ? (
                        <p className="mt-1 text-xs text-[var(--ui-text-subtle)]">参照URL数: {complementSources.length}</p>
                      ) : null}
                      <p className="mt-1 font-mono text-xs text-[var(--ui-text-subtle)]">{event?.event_type ?? "-"}</p>
                    </td>
                    <td className="px-4 py-3 font-mono">{row.candidate_score}</td>
                    <td className="px-4 py-3">{row.status}</td>
                    <td className="px-4 py-3 font-mono">{event?.confidence ?? "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
