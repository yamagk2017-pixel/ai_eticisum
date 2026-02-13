import { createServerClient } from "@/lib/supabase/server";
import { scrapeTicketDiveEvent } from "./ticketdive-scraper";

type ExternalIdRow = {
  group_id: string;
  external_id: string | null;
  url: string | null;
};

type GroupRow = {
  id: string;
  name_ja: string | null;
};

function ticketdiveIdFromRow(row: ExternalIdRow): string | null {
  if (row.external_id && row.external_id.trim()) return row.external_id.trim();
  if (!row.url) return null;
  const match = row.url.match(/ticketdive\.com\/artist\/([^/?#]+)/i);
  return match?.[1] ?? null;
}

export async function updateAllGroupEvents() {
  const supabase = createServerClient();
  const { data: extRows, error } = await supabase
    .schema("imd")
    .from("external_ids")
    .select("group_id,external_id,url")
    .eq("service", "ticketdive");

  if (error) {
    throw new Error(error.message);
  }

  const externalRows = (extRows ?? []) as ExternalIdRow[];
  const candidates = externalRows
    .map((row) => ({ groupId: row.group_id, ticketdiveId: ticketdiveIdFromRow(row) }))
    .filter((row): row is { groupId: string; ticketdiveId: string } => !!row.ticketdiveId);

  if (candidates.length === 0) {
    return { total: 0, processed: 0, success: 0, failed: 0, errors: [] as string[] };
  }

  const groupIds = Array.from(new Set(candidates.map((c) => c.groupId)));
  const { data: groups } = await supabase
    .schema("imd")
    .from("groups")
    .select("id,name_ja")
    .in("id", groupIds);
  const groupMap = new Map<string, GroupRow>(((groups ?? []) as GroupRow[]).map((g) => [g.id, g]));

  const results = {
    total: candidates.length,
    processed: 0,
    success: 0,
    failed: 0,
    errors: [] as string[],
  };

  const batchSize = 50;
  for (let i = 0; i < candidates.length; i += batchSize) {
    const batch = candidates.slice(i, i + batchSize);
    const settled = await Promise.allSettled(
      batch.map(async (item) => {
        const res = await scrapeTicketDiveEvent(item.groupId, item.ticketdiveId);
        const name = groupMap.get(item.groupId)?.name_ja ?? item.groupId;
        return { name, ...res };
      })
    );

    for (const item of settled) {
      results.processed += 1;
      if (item.status === "fulfilled" && item.value.success) {
        results.success += 1;
      } else {
        results.failed += 1;
        if (item.status === "fulfilled") {
          results.errors.push(`${item.value.name}: ${item.value.error ?? "failed"}`);
        } else {
          results.errors.push(`unknown: ${String(item.reason)}`);
        }
      }
    }

    if (i + batchSize < candidates.length) {
      await new Promise((resolve) => setTimeout(resolve, 700));
    }
  }

  return results;
}
