"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type GroupRow = {
  id: string;
  name_ja: string | null;
  slug: string | null;
  artist_image_url: string | null;
};

type MetricRow = {
  id: string;
  label: string;
  type: "fixed" | "free" | string;
};

type MetricCountRow = {
  label: string;
  count: number;
  kind: "fixed" | "freeword" | string;
  metric_id: string | null;
  freeword_id: string | null;
};

type SelectedItem = {
  kind: "fixed" | "freeword";
  id: string;
  label: string;
};

type ExternalIdRow = {
  id: string;
  group_id: string;
  service: string;
  external_id: string | null;
  url: string | null;
  meta: unknown;
  created_at: string | null;
};

type GroupProfileRow = {
  id: string;
  group_id: string;
  locale: string;
  body: string | null;
};

type GroupAttributeKVRow = {
  id: string;
  group_id: string;
  key: string;
  locale: string;
  value: string | null;
};

type Props = {
  slug: string;
};

export function GroupDetail({ slug }: Props) {
  const params = useParams<{ slug?: string }>();
  const rawSlug =
    slug ??
    (typeof params.slug === "string"
      ? params.slug
      : Array.isArray(params.slug)
      ? params.slug[0]
      : "");
  const safeSlug = rawSlug.trim();
  const [group, setGroup] = useState<GroupRow | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState<string>("");

  const [fixedMetrics, setFixedMetrics] = useState<MetricRow[]>([]);
  const [freeMetricId, setFreeMetricId] = useState<string | null>(null);
  const [metricCounts, setMetricCounts] = useState<MetricCountRow[]>([]);
  const [totalVotes, setTotalVotes] = useState<number | null>(null);
  const [rank, setRank] = useState<number | null>(null);
  const [voteRank, setVoteRank] = useState<number | null>(null);
  const [externalIds, setExternalIds] = useState<ExternalIdRow[]>([]);
  const [profileBody, setProfileBody] = useState<string | null>(null);
  const [groupAttributes, setGroupAttributes] = useState<{
    members: string | null;
    location: string | null;
    agency: string | null;
  } | null>(null);
  const [metricsReady, setMetricsReady] = useState(false);

  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [newFreeword, setNewFreeword] = useState<string>("");
  const [voteStatus, setVoteStatus] = useState<"idle" | "saving" | "error" | "success">(
    "idle"
  );
  const [voteMessage, setVoteMessage] = useState<string>("");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      setStatus("loading");
      const supabase = createClient();

      if (!safeSlug) {
        setStatus("error");
        setMessage("slugが指定されていません。");
        return;
      }

      const { data, error } = await supabase
        .schema("imd")
        .from("groups")
        .select("id,name_ja,slug,artist_image_url")
        .ilike("slug", safeSlug)
        .maybeSingle();

      if (error) {
        setStatus("error");
        setMessage(error.message);
        return;
      }

      setGroup(data);
      setStatus("idle");
    };

    run().catch((err: unknown) => {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Unknown error");
    });
  }, [safeSlug]);

  useEffect(() => {
    if (!group?.id) {
      return;
    }

    const run = async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .schema("imd")
        .from("external_ids")
        .select("id,group_id,service,external_id,url,meta,created_at")
        .eq("group_id", group.id);

      if (!error) {
        setExternalIds(data ?? []);
      }

      const { data: profileRow } = await supabase
        .schema("imd")
        .from("group_profiles")
        .select("id,group_id,locale,body")
        .eq("group_id", group.id)
        .eq("locale", "ja")
        .maybeSingle();

      setProfileBody((profileRow as GroupProfileRow | null)?.body ?? null);

      const { data: attributesRows } = await supabase
        .schema("imd")
        .from("group_attributes")
        .select("id,group_id,key,locale,value")
        .eq("group_id", group.id)
        .eq("locale", "ja")
        .in("key", ["members", "location", "agency"]);

      if (attributesRows && attributesRows.length > 0) {
        const map = new Map<string, string | null>();
        for (const row of attributesRows as GroupAttributeKVRow[]) {
          map.set(row.key, row.value ?? null);
        }
        setGroupAttributes({
          members: map.get("members") ?? null,
          location: map.get("location") ?? null,
          agency: map.get("agency") ?? null,
        });
      } else {
        setGroupAttributes(null);
      }
    };

    run().catch(() => {
      setExternalIds([]);
      setProfileBody(null);
      setGroupAttributes(null);
    });
  }, [group?.id]);

  useEffect(() => {
    const supabase = createClient();

    const fetchUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUserEmail(data.user?.email ?? null);
      setUserId(data.user?.id ?? null);
      setAuthReady(true);
    };

    fetchUser().catch(() => {
      setUserEmail(null);
      setUserId(null);
      setAuthReady(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user?.email ?? null);
      setUserId(session?.user?.id ?? null);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  const fetchMetricsAndCounts = async (groupId: string) => {
    const supabase = createClient();
    const [metricsResponse, freeMetricResponse, metricCountsResponse, totalVotesResponse] =
      await Promise.all([
        supabase
          .schema("nandatte")
          .from("metrics")
          .select("id,label,type")
          .eq("type", "fixed")
          .order("label", { ascending: true }),
        supabase
          .schema("nandatte")
          .from("metrics")
          .select("id")
          .eq("type", "free")
          .limit(1)
          .maybeSingle(),
        supabase
          .schema("nandatte")
          .rpc("get_group_metric_counts", { p_group_id: groupId }),
        supabase
          .schema("nandatte")
          .rpc("get_group_vote_total", { p_group_id: groupId }),
      ]);

    if (metricsResponse.error) {
      setVoteStatus("error");
      setVoteMessage(metricsResponse.error.message);
      return;
    }

    setFixedMetrics(metricsResponse.data ?? []);
    setFreeMetricId(freeMetricResponse.data?.id ?? null);

    if (metricCountsResponse.error) {
      setVoteStatus("error");
      setVoteMessage(metricCountsResponse.error.message);
      return;
    }

    const counts = (metricCountsResponse.data ?? []).map((row: any) => ({
      label: row.label as string,
      count: Number(row.count ?? 0),
      kind: row.kind as string,
      metric_id: row.metric_id as string | null,
      freeword_id: row.freeword_id as string | null,
    }));

    setMetricCounts(counts);
    setTotalVotes(
      totalVotesResponse.error ? 0 : Number(totalVotesResponse.data ?? 0)
    );
    setMetricsReady(true);

    const { data: voteRankRow, error: voteRankError } = await supabase
      .schema("nandatte")
      .rpc("get_group_vote_rank", { p_group_id: groupId });

    if (!voteRankError) {
      setVoteRank(Number(voteRankRow ?? null));
    }

    const { data: rankRow, error: rankError } = await supabase
      .schema("ihc")
      .from("daily_rankings")
      .select("rank")
      .eq("group_id", groupId)
      .order("snapshot_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!rankError) {
      setRank(rankRow?.rank ?? null);
    }
  };

  useEffect(() => {
    if (!group?.id) {
      return;
    }

    setMetricsReady(false);
    fetchMetricsAndCounts(group.id).catch((err: unknown) => {
      setVoteStatus("error");
      setVoteMessage(err instanceof Error ? err.message : "Unknown error");
    });
  }, [group?.id]);

  const sortedCounts = useMemo(() => {
    return [...metricCounts].sort((a, b) => {
      if (b.count !== a.count) {
        return b.count - a.count;
      }
      return a.label.localeCompare(b.label, "ja");
    });
  }, [metricCounts]);

  const maxCount = sortedCounts[0]?.count ?? 0;

  const freewordCounts = useMemo(() => {
    return sortedCounts
      .filter((row) => row.kind === "freeword" && row.freeword_id)
      .map((row) => ({
        id: row.freeword_id as string,
        text: row.label,
        count: row.count,
      }));
  }, [sortedCounts]);

  const serviceMap = useMemo(() => {
    const map = new Map<string, ExternalIdRow>();
    for (const row of externalIds) {
      if (!map.has(row.service)) {
        map.set(row.service, row);
      }
    }
    return map;
  }, [externalIds]);

  const spotifyUrl = serviceMap.get("spotify")?.url ?? null;
  const spotifyExternalId = serviceMap.get("spotify")?.external_id ?? null;
  const youtubeUrl = serviceMap.get("youtube_channel")?.url ?? null;
  const youtubeExternalId = serviceMap.get("youtube_channel")?.external_id ?? null;

  const spotifyEmbedUrl = useMemo(() => {
    // Prefer artist embed only. Ignore track/album/playlist embeds.
    if (spotifyExternalId) {
      const uriMatch = spotifyExternalId.match(/^spotify:artist:([A-Za-z0-9]+)$/);
      if (uriMatch) {
        return `https://open.spotify.com/embed/artist/${uriMatch[1]}`;
      }
      const urlMatch = spotifyExternalId.match(
        /open\.spotify\.com\/artist\/([A-Za-z0-9]+)/
      );
      if (urlMatch) {
        return `https://open.spotify.com/embed/artist/${urlMatch[1]}`;
      }
      if (/^[A-Za-z0-9]+$/.test(spotifyExternalId)) {
        return `https://open.spotify.com/embed/artist/${spotifyExternalId}`;
      }
    }

    if (spotifyUrl) {
      const artistMatch = spotifyUrl.match(/spotify\.com\/artist\/([A-Za-z0-9]+)/);
      if (artistMatch) {
        return `https://open.spotify.com/embed/artist/${artistMatch[1]}`;
      }
    }

    return null;
  }, [spotifyUrl, spotifyExternalId]);

  const [youtubeVideoId, setYoutubeVideoId] = useState<string | null>(null);
  const [youtubeStatus, setYoutubeStatus] = useState<"idle" | "loading" | "error">(
    "idle"
  );

  useEffect(() => {
    if (!youtubeUrl && !youtubeExternalId) {
      setYoutubeVideoId(null);
      return;
    }

    const run = async () => {
      setYoutubeStatus("loading");
      const params = new URLSearchParams();
      if (youtubeUrl) params.set("url", youtubeUrl);
      if (youtubeExternalId) params.set("external_id", youtubeExternalId);
      const res = await fetch(`/api/youtube?${params.toString()}`);
      const data = (await res.json()) as { videoId?: string };
      setYoutubeVideoId(data.videoId ?? null);
      setYoutubeStatus("idle");
    };

    run().catch(() => {
      setYoutubeVideoId(null);
      setYoutubeStatus("error");
    });
  }, [youtubeUrl, youtubeExternalId]);

  const selectedCount = selectedItems.length + (newFreeword.trim() ? 1 : 0);
  const isLoggedIn = !!userEmail;
  const rankDisplay =
    rank === null ? "-" : !isLoggedIn && rank > 100 ? "非公開" : rank;
  const visibleCounts = isLoggedIn ? sortedCounts : sortedCounts.slice(0, 5);
  const hiddenCount = Math.max(0, sortedCounts.length - visibleCounts.length);

  useEffect(() => {
    if (!group?.id || !userId || !metricsReady) {
      return;
    }

    const run = async () => {
      const supabase = createClient();
      const { data: voteRow } = await supabase
        .schema("nandatte")
        .from("votes")
        .select("id")
        .eq("user_id", userId)
        .eq("group_id", group.id)
        .maybeSingle();

      if (!voteRow?.id) {
        setSelectedItems([]);
        return;
      }

      const { data: items } = await supabase
        .schema("nandatte")
        .from("vote_items")
        .select("metric_id,freeword_id")
        .eq("vote_id", voteRow.id);

      if (!items) {
        return;
      }

      const freewordLabelMap = new Map(
        freewordCounts.map((row) => [row.id, row.text])
      );

      const selected: SelectedItem[] = [];

      for (const item of items as any[]) {
        if (item.freeword_id) {
          let label = freewordLabelMap.get(item.freeword_id) ?? null;
          if (!label) {
            const { data: freewordRow } = await supabase
              .schema("nandatte")
              .from("metric_freewords")
              .select("text")
              .eq("id", item.freeword_id)
              .maybeSingle();
            label = freewordRow?.text ?? null;
          }
          const finalLabel = label ?? "フリーワード";
          selected.push({
            kind: "freeword",
            id: item.freeword_id,
            label: finalLabel,
          });
          continue;
        }

        if (item.metric_id) {
          const metric = fixedMetrics.find((row) => row.id === item.metric_id);
          if (metric) {
            selected.push({
              kind: "fixed",
              id: metric.id,
              label: metric.label,
            });
          }
        }
      }

      setSelectedItems(selected);
    };

    run().catch(() => {
      setSelectedItems([]);
    });
  }, [group?.id, userId, metricsReady, fixedMetrics, freewordCounts]);

  const toggleSelection = (item: SelectedItem) => {
    setVoteMessage("");
    const exists = selectedItems.some(
      (selected) => selected.kind === item.kind && selected.id === item.id
    );

    if (exists) {
      setSelectedItems((prev) =>
        prev.filter(
          (selected) =>
            !(selected.kind === item.kind && selected.id === item.id)
        )
      );
      return;
    }

    if (selectedItems.length >= 5) {
      setVoteMessage("選択は最大5件までです。");
      return;
    }

    setSelectedItems((prev) => [...prev, item]);
  };

  const handleVoteSubmit = async () => {
    if (!group?.id) {
      return;
    }

    setVoteStatus("saving");
    setVoteMessage("");

    const supabase = createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData?.user) {
      setVoteStatus("error");
      setVoteMessage("投票にはログインが必要です。");
      return;
    }

    const trimmedFreeword = newFreeword.trim();
    const pendingItems: SelectedItem[] = [...selectedItems];

    if (trimmedFreeword) {
      if (trimmedFreeword.length > 10) {
        setVoteStatus("error");
        setVoteMessage("フリーワードは10文字以内にしてください。");
        return;
      }

      if (pendingItems.length >= 5) {
        setVoteStatus("error");
        setVoteMessage("フリーワードを追加する場合、選択は4件以下にしてください。");
        return;
      }

      const { data: existingFreeword } = await supabase
        .schema("nandatte")
        .from("metric_freewords")
        .select("id,text")
        .eq("normalized_text", trimmedFreeword)
        .maybeSingle();

      let freewordId = existingFreeword?.id ?? null;
      let freewordLabel = existingFreeword?.text ?? trimmedFreeword;

      if (!freewordId) {
        const { data: insertedFreeword, error: insertError } = await supabase
          .schema("nandatte")
          .from("metric_freewords")
          .insert({
            text: trimmedFreeword,
            normalized_text: trimmedFreeword,
            created_by: authData.user.id,
          })
          .select("id,text")
          .single();

        if (insertError) {
          setVoteStatus("error");
          setVoteMessage(insertError.message);
          return;
        }

        freewordId = insertedFreeword.id;
        freewordLabel = insertedFreeword.text;
      }

      pendingItems.push({
        kind: "freeword",
        id: freewordId,
        label: freewordLabel,
      });
    }

    if (pendingItems.length === 0) {
      setVoteStatus("error");
      setVoteMessage("少なくとも1つ選択してください。");
      return;
    }

    if (pendingItems.length > 5) {
      setVoteStatus("error");
      setVoteMessage("選択は最大5件までです。");
      return;
    }

    if (!freeMetricId) {
      setVoteStatus("error");
      setVoteMessage("フリーワード用のメトリクスが未設定です。");
      return;
    }

    const { data: voteRow, error: voteError } = await supabase
      .schema("nandatte")
      .from("votes")
      .upsert(
        {
          user_id: authData.user.id,
          group_id: group.id,
        },
        { onConflict: "user_id,group_id" }
      )
      .select("id")
      .single();

    if (voteError || !voteRow) {
      setVoteStatus("error");
      setVoteMessage(voteError?.message ?? "投票の保存に失敗しました。");
      return;
    }

    const voteId = voteRow.id as string;

    const { error: deleteError } = await supabase
      .schema("nandatte")
      .from("vote_items")
      .delete()
      .eq("vote_id", voteId);

    if (deleteError) {
      setVoteStatus("error");
      setVoteMessage(deleteError.message);
      return;
    }

    const payload = pendingItems.map((item) =>
      item.kind === "fixed"
        ? {
            vote_id: voteId,
            metric_id: item.id,
            freeword_id: null,
          }
        : {
            vote_id: voteId,
            metric_id: freeMetricId,
            freeword_id: item.id,
          }
    );

    const { error: insertItemsError } = await supabase
      .schema("nandatte")
      .from("vote_items")
      .insert(payload);

    if (insertItemsError) {
      setVoteStatus("error");
      setVoteMessage(insertItemsError.message);
      return;
    }

    setVoteStatus("success");
    setVoteMessage("投票を保存しました。");
    setSelectedItems(pendingItems);
    setNewFreeword("");
    fetchMetricsAndCounts(group.id).catch(() => null);
  };

  const handleSignIn = async () => {
    setVoteMessage("");
    const supabase = createClient();
    const redirectTo = window.location.href;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });

    if (error) {
      setVoteStatus("error");
      setVoteMessage(error.message);
    }
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
  };

  if (status === "loading") {
    return <p className="text-sm text-zinc-400">読み込み中...</p>;
  }

  if (status === "error") {
    return (
      <p className="text-sm text-red-200">読み込みに失敗しました: {message}</p>
    );
  }

  if (!group) {
    return <p className="text-sm text-zinc-400">該当グループがありません。</p>;
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
        <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Group</p>
        <div className="mt-3 flex flex-wrap items-start gap-6">
          {group.artist_image_url ? (
            <img
              src={group.artist_image_url}
              alt={group.name_ja ? `${group.name_ja} image` : "artist image"}
              className="h-24 w-24 rounded-xl object-cover border border-zinc-700"
              loading="lazy"
            />
          ) : null}
          <h1 className="text-3xl font-semibold">
            {group.name_ja ?? group.slug}
          </h1>
          <div className="text-sm text-zinc-300">
            <p>総合順位: {rankDisplay}</p>
            <p>投票数順位: {voteRank ?? "-"}</p>
            <p>総得票数: {totalVotes ?? 0}</p>
          </div>
        </div>
        <p className="mt-2 text-xs text-zinc-500">slug: {group.slug}</p>
      </header>

      {(profileBody || groupAttributes) && (
        <section className="grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
            <h2 className="text-xl font-semibold">プロフィール</h2>
            {profileBody ? (
              <p className="mt-4 text-sm leading-7 text-zinc-200 whitespace-pre-wrap">
                {profileBody}
              </p>
            ) : (
              <p className="mt-4 text-sm text-zinc-400">プロフィールが未登録です。</p>
            )}
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
            <h2 className="text-xl font-semibold">基本情報</h2>
            {groupAttributes ? (
              <dl className="mt-4 space-y-3 text-sm text-zinc-200">
                <div className="flex flex-col gap-1">
                  <dt className="text-xs text-zinc-400">メンバー</dt>
                  <dd>{groupAttributes.members ?? "-"}</dd>
                </div>
                <div className="flex flex-col gap-1">
                  <dt className="text-xs text-zinc-400">活動拠点</dt>
                  <dd>{groupAttributes.location ?? "-"}</dd>
                </div>
                <div className="flex flex-col gap-1">
                  <dt className="text-xs text-zinc-400">事務所</dt>
                  <dd>{groupAttributes.agency ?? "-"}</dd>
                </div>
              </dl>
            ) : (
              <p className="mt-4 text-sm text-zinc-400">基本情報が未登録です。</p>
            )}
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl font-semibold">公式リンク</h2>
          <span className="text-xs text-zinc-400">imd.external_ids</span>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          {[
            { label: "X", key: "x" },
            { label: "Instagram", key: "instagram" },
            { label: "TikTok", key: "tiktok" },
            { label: "公式サイト", key: "website" },
            { label: "スケジュール", key: "schedule" },
          ].map((item) => {
            const url = serviceMap.get(item.key)?.url ?? null;
            if (!url) return null;
            return (
              <a
                key={item.key}
                href={url}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-200 hover:border-zinc-500"
              >
                {item.label}
              </a>
            );
          })}
        </div>
        {!serviceMap.size && (
          <p className="mt-4 text-sm text-zinc-400">外部リンクがまだ登録されていません。</p>
        )}
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
          <h2 className="text-xl font-semibold">Spotify プレビュー</h2>
          {spotifyEmbedUrl ? (
            <iframe
              className="mt-4 block w-full"
              src={spotifyEmbedUrl}
              height="352"
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              loading="lazy"
              title="Spotify preview"
            />
          ) : (
            <p className="mt-4 text-sm text-zinc-400">
              Spotifyアーティスト情報が未登録です。
            </p>
          )}
          {spotifyUrl && (
            <a
              href={spotifyUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex text-xs text-zinc-400 hover:text-white"
            >
              Spotifyで開く →
            </a>
          )}
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
          <h2 className="text-xl font-semibold">YouTube プレビュー</h2>
          {youtubeStatus === "loading" && (
            <p className="mt-4 text-sm text-zinc-400">動画を読み込み中...</p>
          )}
          {youtubeStatus !== "loading" && youtubeVideoId ? (
            <iframe
              className="mt-4 w-full rounded-xl border border-zinc-800"
              src={`https://www.youtube.com/embed/${youtubeVideoId}`}
              height="152"
              loading="lazy"
              title="YouTube preview"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            youtubeStatus !== "loading" && (
              <p className="mt-4 text-sm text-zinc-400">
                YouTubeの最新動画が取得できませんでした。
              </p>
            )
          )}
          {youtubeUrl && (
            <a
              href={youtubeUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex text-xs text-zinc-400 hover:text-white"
            >
              YouTubeで開く →
            </a>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl font-semibold">魅力ランキング</h2>
          <span className="text-xs text-zinc-400">
            上位5件をハイライト / 6位以下も表示
          </span>
        </div>
        <div className="mt-6 flex flex-col gap-4">
          {sortedCounts.length === 0 && (
            <p className="text-sm text-zinc-400">まだ投票がありません。</p>
          )}
          {visibleCounts.map((item, index) => {
            const width = maxCount ? Math.round((item.count / maxCount) * 100) : 0;
            const isTopFive = index < 5;
            return (
              <div
                key={`${item.label}-${index}`}
                className={`rounded-xl border px-4 py-3 ${
                  isTopFive
                    ? "border-zinc-500 bg-zinc-800/60"
                    : "border-zinc-800 bg-zinc-900/40"
                }`}
              >
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">
                    {index + 1}. {item.label}
                  </span>
                  <span className="text-zinc-300">{item.count}</span>
                </div>
                <div className="mt-2 h-2 w-full rounded-full bg-zinc-800">
                  <div
                    className={`h-2 rounded-full ${
                      isTopFive ? "bg-amber-400" : "bg-zinc-600"
                    }`}
                    style={{ width: `${width}%` }}
                  />
                </div>
              </div>
            );
          })}
          {!isLoggedIn && hiddenCount > 0 && (
            <div className="rounded-xl border border-dashed border-zinc-700 px-4 py-3 text-sm text-zinc-400">
              その他 {hiddenCount} 件
            </div>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">投票する</h2>
          <span className="text-xs text-zinc-400">最大5件まで選択</span>
        </div>

        <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-300">
          {!authReady && <p>ログイン状態を確認中...</p>}
          {authReady && userEmail && (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-zinc-200">ログイン中: {userEmail}</span>
              <button
                type="button"
                onClick={handleSignOut}
                className="rounded-full border border-zinc-700 px-4 py-1 text-xs text-zinc-300 hover:border-zinc-500"
              >
                ログアウト
              </button>
            </div>
          )}
          {authReady && !userEmail && (
            <div className="flex flex-wrap items-center gap-3">
              <span>投票にはログインが必要です。</span>
              <button
                type="button"
                onClick={handleSignIn}
                className="rounded-full bg-white px-4 py-1 text-xs font-semibold text-zinc-900 hover:bg-zinc-200"
              >
                Googleでログイン
              </button>
            </div>
          )}
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold text-zinc-200">固定の魅力候補</h3>
            <div className="mt-3 grid gap-2">
              {fixedMetrics.map((metric) => {
                const selected = selectedItems.some(
                  (item) => item.kind === "fixed" && item.id === metric.id
                );
                return (
                  <button
                    key={metric.id}
                    type="button"
                    className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                      selected
                        ? "border-amber-400 bg-amber-400/10 text-amber-100"
                        : "border-zinc-800 bg-zinc-950 text-zinc-200 hover:border-zinc-600"
                    }`}
                    onClick={() =>
                      toggleSelection({
                        kind: "fixed",
                        id: metric.id,
                        label: metric.label,
                      })
                    }
                  >
                    {metric.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-zinc-200">
              このグループで使われているフリーワード
            </h3>
            <div className="mt-3 grid gap-2">
              {freewordCounts.length === 0 && (
                <p className="text-xs text-zinc-500">まだフリーワードがありません。</p>
              )}
              {freewordCounts.map((freeword) => {
                const selected = selectedItems.some(
                  (item) => item.kind === "freeword" && item.id === freeword.id
                );
                return (
                  <button
                    key={freeword.id}
                    type="button"
                    className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition ${
                      selected
                        ? "border-amber-400 bg-amber-400/10 text-amber-100"
                        : "border-zinc-800 bg-zinc-950 text-zinc-200 hover:border-zinc-600"
                    }`}
                    onClick={() =>
                      toggleSelection({
                        kind: "freeword",
                        id: freeword.id,
                        label: freeword.text,
                      })
                    }
                  >
                    <span>{freeword.text}</span>
                    <span className="text-xs text-zinc-500">{freeword.count}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-6">
          <label className="text-sm font-semibold text-zinc-200" htmlFor="freeword">
            新規フリーワード（10文字以内）
          </label>
          <input
            id="freeword"
            value={newFreeword}
            onChange={(event) => setNewFreeword(event.target.value)}
            maxLength={10}
            className="mt-2 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-amber-400 focus:outline-none"
            placeholder="例: 世界観が良い"
          />
          <p className="mt-2 text-xs text-zinc-500">
            新規フリーワードは投票時に1件としてカウントされます。
          </p>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={handleVoteSubmit}
            className="rounded-full bg-amber-400 px-6 py-2 text-sm font-semibold text-black hover:bg-amber-300"
            disabled={voteStatus === "saving"}
          >
            {voteStatus === "saving" ? "保存中..." : "投票する"}
          </button>
          <span className="text-xs text-zinc-400">
            選択数: {selectedCount} / 5
          </span>
          {voteMessage && (
            <span
              className={`text-xs ${
                voteStatus === "success" ? "text-emerald-300" : "text-red-200"
              }`}
            >
              {voteMessage}
            </span>
          )}
        </div>
      </section>
    </div>
  );
}
