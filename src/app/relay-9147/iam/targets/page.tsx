import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type TargetRow = {
  week_key: string;
  group_id: string;
  target_reasons: string[] | null;
  priority: number;
  created_at: string;
};

type GroupRow = {
  id: string;
  name_ja: string | null;
  slug: string | null;
};

type TargetsData = {
  weekKey: string | null;
  rows: TargetRow[];
  groupMap: Map<string, GroupRow>;
  error: string | null;
};

async function getLatestWeekKey() {
  const supabase = createServerClient({ requireServiceRole: true });
  const { data, error } = await supabase
    .schema("imd")
    .from("weekly_targets")
    .select("week_key")
    .order("week_key", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data?.week_key ?? null;
}

async function getTargetRows(weekKey: string) {
  const supabase = createServerClient({ requireServiceRole: true });
  const { data, error } = await supabase
    .schema("imd")
    .from("weekly_targets")
    .select("week_key,group_id,target_reasons,priority,created_at")
    .eq("week_key", weekKey)
    .order("priority", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as TargetRow[];
}

async function getGroupMap(groupIds: string[]) {
  if (groupIds.length === 0) return new Map<string, GroupRow>();
  const supabase = createServerClient({ requireServiceRole: true });
  const { data, error } = await supabase
    .schema("imd")
    .from("groups")
    .select("id,name_ja,slug")
    .in("id", groupIds);

  if (error) throw new Error(error.message);
  return new Map(((data ?? []) as GroupRow[]).map((row) => [row.id, row]));
}

async function loadTargetsData(): Promise<TargetsData> {
  try {
    const weekKey = await getLatestWeekKey();
    if (!weekKey) {
      return { weekKey: null, rows: [], groupMap: new Map<string, GroupRow>(), error: null };
    }

    const rows = await getTargetRows(weekKey);
    const groupMap = await getGroupMap(rows.map((row) => row.group_id));

    return { weekKey, rows, groupMap, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { weekKey: null, rows: [], groupMap: new Map<string, GroupRow>(), error: message };
  }
}

export default async function IamTargetsPage() {
  const { weekKey, rows, groupMap, error } = await loadTargetsData();

  if (error) {
    return (
      <div className="min-h-screen bg-[var(--ui-page)] px-6 py-12 text-[var(--ui-text)]">
        <div className="mx-auto max-w-5xl rounded-2xl border border-red-500/40 bg-red-500/10 p-6">
          <p className="text-sm">Failed to load weekly targets: {error}</p>
          <Link href="/relay-9147/iam" className="mt-3 inline-block text-sm text-[var(--ui-accent)]">
            IAMトップへ戻る
          </Link>
        </div>
      </div>
    );
  }

  if (!weekKey) {
    return (
      <div className="min-h-screen bg-[var(--ui-page)] px-6 py-12 text-[var(--ui-text)]">
        <div className="mx-auto max-w-5xl rounded-2xl border border-[var(--ui-border)] p-6">
          <p className="text-sm text-[var(--ui-text-muted)]">weekly_targets はまだ空です。</p>
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
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--ui-text-subtle)]">IAM / Targets</p>
          <h1 className="text-2xl font-semibold">今週の監視対象</h1>
          <p className="text-sm text-[var(--ui-text-muted)]">
            week_key: <span className="font-mono">{weekKey}</span> / {rows.length}件
          </p>
          <Link href="/relay-9147/iam" className="inline-block text-sm text-[var(--ui-accent)]">
            IAMトップへ戻る
          </Link>
        </header>

        <div className="overflow-hidden rounded-2xl border border-[var(--ui-border)]">
          <table className="w-full text-left text-sm">
            <thead className="bg-black/20 text-xs uppercase tracking-wider text-[var(--ui-text-subtle)]">
              <tr>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Group</th>
                <th className="px-4 py-3">Target Reasons</th>
                <th className="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const group = groupMap.get(row.group_id);
                return (
                  <tr key={`${row.week_key}-${row.group_id}`} className="border-t border-[var(--ui-border)]">
                    <td className="px-4 py-3 font-mono">{row.priority}</td>
                    <td className="px-4 py-3">
                      <p>{group?.name_ja ?? row.group_id}</p>
                      <p className="text-xs text-[var(--ui-text-subtle)]">{group?.slug ?? "-"}</p>
                    </td>
                    <td className="px-4 py-3">
                      {(row.target_reasons ?? []).length > 0 ? (
                        <ul className="list-disc pl-4">
                          {(row.target_reasons ?? []).map((reason) => (
                            <li key={reason}>{reason}</li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-[var(--ui-text-subtle)]">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{row.created_at}</td>
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
