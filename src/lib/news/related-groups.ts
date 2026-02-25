import {createServerClient} from "@/lib/supabase/server";
import type {SanityRelatedGroup} from "@/lib/news/sanity";

type ImdGroupRow = {
  id: string;
  name_ja: string | null;
  slug: string | null;
};

type ExternalIdRow = {
  group_id: string;
  service: string | null;
  external_id: string | null;
  url: string | null;
  created_at: string | null;
};

type EventRow = {
  group_id: string;
  event_name: string | null;
  event_date: string | null;
  venue_name: string | null;
  event_url: string | null;
  updated_at?: string | null;
};

export type NewsRelatedGroupInfo = {
  imdGroupId: string | null;
  groupNameJa: string;
  slug: string | null;
  websiteUrl: string | null;
  spotifyUrl: string | null;
  spotifyExternalId: string | null;
  youtubeUrl: string | null;
  youtubeExternalId: string | null;
  latestEvent: {
    eventName: string | null;
    eventDate: string | null;
    venueName: string | null;
    eventUrl: string | null;
  } | null;
};

function selectBestByService(rows: ExternalIdRow[]): Map<string, ExternalIdRow> {
  const map = new Map<string, ExternalIdRow>();
  for (const row of rows) {
    const service = (row.service ?? "").trim();
    if (!service) continue;
    const current = map.get(service);
    if (!current) {
      map.set(service, row);
      continue;
    }
    const currentScore = (current.url ? 1 : 0) + (current.external_id ? 1 : 0);
    const nextScore = (row.url ? 1 : 0) + (row.external_id ? 1 : 0);
    if (nextScore > currentScore) map.set(service, row);
  }
  return map;
}

function normalizeRelatedGroupFallback(item: SanityRelatedGroup): NewsRelatedGroupInfo {
  return {
    imdGroupId: item.imdGroupId ?? null,
    groupNameJa: item.groupNameJa,
    slug: null,
    websiteUrl: null,
    spotifyUrl: null,
    spotifyExternalId: null,
    youtubeUrl: null,
    youtubeExternalId: null,
    latestEvent: null,
  };
}

export async function getNewsRelatedGroupsInfo(
  relatedGroups: SanityRelatedGroup[]
): Promise<NewsRelatedGroupInfo[]> {
  if (relatedGroups.length === 0) return [];

  const ordered = relatedGroups.map(normalizeRelatedGroupFallback);
  const ids = Array.from(
    new Set(
      relatedGroups
        .map((item) => (typeof item.imdGroupId === "string" ? item.imdGroupId : null))
        .filter((id): id is string => Boolean(id))
    )
  );

  if (ids.length === 0) return ordered;

  try {
    const supabase = createServerClient();

    const [{data: groupsData}, {data: extData}, {data: eventData}] = await Promise.all([
      supabase.schema("imd").from("groups").select("id,name_ja,slug").in("id", ids),
      supabase
        .schema("imd")
        .from("external_ids")
        .select("group_id,service,external_id,url,created_at")
        .in("group_id", ids)
        .order("created_at", {ascending: false}),
      supabase
        .from("events")
        .select("group_id,event_name,event_date,venue_name,event_url,updated_at")
        .in("group_id", ids)
        .order("updated_at", {ascending: false}),
    ]);

    const groupMap = new Map<string, ImdGroupRow>();
    for (const row of (groupsData ?? []) as ImdGroupRow[]) {
      if (typeof row.id === "string") groupMap.set(row.id, row);
    }

    const extRowsByGroup = new Map<string, ExternalIdRow[]>();
    for (const row of (extData ?? []) as ExternalIdRow[]) {
      if (!row.group_id) continue;
      const list = extRowsByGroup.get(row.group_id) ?? [];
      list.push(row);
      extRowsByGroup.set(row.group_id, list);
    }

    const latestEventByGroup = new Map<string, EventRow>();
    for (const row of (eventData ?? []) as EventRow[]) {
      if (!row.group_id) continue;
      if (!latestEventByGroup.has(row.group_id)) {
        latestEventByGroup.set(row.group_id, row);
      }
    }

    return relatedGroups.map((item) => {
      const fallback = normalizeRelatedGroupFallback(item);
      if (!item.imdGroupId) return fallback;

      const group = groupMap.get(item.imdGroupId);
      const serviceMap = selectBestByService(extRowsByGroup.get(item.imdGroupId) ?? []);
      const website = serviceMap.get("website");
      const spotify = serviceMap.get("spotify");
      const youtube = serviceMap.get("youtube_channel");
      const latestEvent = latestEventByGroup.get(item.imdGroupId) ?? null;

      return {
        imdGroupId: item.imdGroupId,
        groupNameJa: group?.name_ja ?? item.groupNameJa,
        slug: group?.slug ?? null,
        websiteUrl: website?.url ?? null,
        spotifyUrl: spotify?.url ?? null,
        spotifyExternalId: spotify?.external_id ?? null,
        youtubeUrl: youtube?.url ?? null,
        youtubeExternalId: youtube?.external_id ?? null,
        latestEvent: latestEvent
          ? {
              eventName: latestEvent.event_name ?? null,
              eventDate: latestEvent.event_date ?? null,
              venueName: latestEvent.venue_name ?? null,
              eventUrl: latestEvent.event_url ?? null,
            }
          : null,
      };
    });
  } catch (error) {
    console.error("[news-related-groups]", error);
    return ordered;
  }
}

