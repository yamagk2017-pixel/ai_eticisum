import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";

type EventRow = {
  id: string;
  group_id: string;
  event_type: string;
  headline: string;
  summary: string | null;
  event_date: string | null;
  importance_score: number | null;
  confidence: number | null;
  is_major: boolean;
  is_ongoing: boolean;
  created_at: string;
};

type GroupRow = {
  id: string;
  name_ja: string | null;
  slug: string | null;
};

type ActivitiesData = {
  rows: EventRow[];
  groupMap: Map<string, GroupRow>;
  error: string | null;
};

async function getRecentEvents() {
  const supabase = createServerClient({ requireServiceRole: true });
  const { data, error } = await supabase
    .schema("imd")
    .from("normalized_events")
    .select("id,group_id,event_type,headline,summary,event_date,importance_score,confidence,is_major,is_ongoing,created_at")
    .order("event_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) throw new Error(error.message);
  return (data ?? []) as EventRow[];
}

async function getGroupMap(groupIds: string[]) {
  if (groupIds.length === 0) return new Map<string, GroupRow>();
  const supabase = createServerClient({ requireServiceRole: true });
  const { data, error } = await supabase.schema("imd").from("groups").select("id,name_ja,slug").in("id", groupIds);

  if (error) throw new Error(error.message);
  return new Map(((data ?? []) as GroupRow[]).map((row) => [row.id, row]));
}

async function loadActivitiesData(): Promise<ActivitiesData> {
  try {
    const rows = await getRecentEvents();
    const groupMap = await getGroupMap([...new Set(rows.map((row) => row.group_id))]);
    return { rows, groupMap, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { rows: [], groupMap: new Map<string, GroupRow>(), error: message };
  }
}

export default async function IamActivitiesPage() {
  const { rows, groupMap, error } = await loadActivitiesData();

  if (error) {
    return (
      <div className="min-h-screen bg-[var(--ui-page)] px-6 py-12 text-[var(--ui-text)]">
        <div className="mx-auto max-w-5xl rounded-2xl border border-red-500/40 bg-red-500/10 p-6">
          <p className="text-sm">Failed to load activities: {error}</p>
          <Link href="/relay-9147/iam" className="mt-3 inline-block text-sm text-[var(--ui-accent)]">
            IAMトップへ戻る
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--ui-page)] px-6 py-12 text-[var(--ui-text)]">
      <main className="mx-auto max-w-6xl space-y-6">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--ui-text-subtle)]">IAM / Activities</p>
          <h1 className="text-2xl font-semibold">週間アクティビティ</h1>
          <p className="text-sm text-[var(--ui-text-muted)]">最新200件を表示（event_date優先）</p>
          <Link href="/relay-9147/iam" className="inline-block text-sm text-[var(--ui-accent)]">
            IAMトップへ戻る
          </Link>
        </header>

        {rows.length === 0 ? (
          <div className="rounded-2xl border border-[var(--ui-border)] p-6 text-sm text-[var(--ui-text-muted)]">
            normalized_events はまだ空です。
          </div>
        ) : (
          <ul className="space-y-3">
            {rows.map((row) => {
              const group = groupMap.get(row.group_id);
              return (
                <li key={row.id} className="rounded-2xl border border-[var(--ui-border)] bg-black/10 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm text-[var(--ui-text-subtle)]">{group?.name_ja ?? row.group_id}</p>
                      <h2 className="text-base font-semibold">{row.headline}</h2>
                    </div>
                    <div className="flex gap-2 text-xs">
                      {row.is_major ? (
                        <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-1 text-amber-300">major</span>
                      ) : null}
                      {row.is_ongoing ? (
                        <span className="rounded-full border border-cyan-400/40 bg-cyan-400/10 px-2 py-1 text-cyan-300">ongoing</span>
                      ) : null}
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-[var(--ui-text-muted)]">{row.summary ?? "-"}</p>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-[var(--ui-text-subtle)]">
                    <span>event_type: {row.event_type}</span>
                    <span>event_date: {row.event_date ?? "-"}</span>
                    <span>importance: {row.importance_score ?? "-"}</span>
                    <span>confidence: {row.confidence ?? "-"}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
