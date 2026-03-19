"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

type DokonanoPoint = {
  groupId: string;
  name: string;
  slug: string | null;
  nandatteHref: string | null;
  careerMonths: number;
  attentionScore: number;
  artistPopularity: number;
  voteCount: number;
  freshnessDays: number;
  freshnessBand: "hot" | "warm" | "active" | "cool" | "stale";
  activityStartedMonth: string | null;
};

type DokonanoApiResponse = {
  points?: DokonanoPoint[];
  meta?: {
    totalGroups: number;
    p95Votes: number;
    weights: {
      spotify: number;
      vote: number;
    };
  };
  error?: string;
};

type KaiwaiRelatedApiResponse = {
  baseGroupId?: string;
  items?: Array<{
    groupId: string;
    overlapUsers: number;
  }>;
  error?: string;
};

const FRESHNESS_COLOR: Record<DokonanoPoint["freshnessBand"], string> = {
  hot: "#ef4444",
  warm: "#f97316",
  active: "#eab308",
  cool: "#22c55e",
  stale: "#3b82f6",
};

type Status = "idle" | "loading" | "error";

function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function DokonanoView() {
  const [points, setPoints] = useState<DokonanoPoint[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [searchText, setSearchText] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [meta, setMeta] = useState({
    totalGroups: 0,
    p95Votes: 1,
    weights: {
      spotify: 0.6,
      vote: 0.4,
    },
  });
  const [showKaiwaiOnly, setShowKaiwaiOnly] = useState(false);
  const [kaiwaiStatus, setKaiwaiStatus] = useState<Status>("idle");
  const [kaiwaiMessage, setKaiwaiMessage] = useState("");
  const [kaiwaiGroupIds, setKaiwaiGroupIds] = useState<string[]>([]);

  useEffect(() => {
    const run = async () => {
      setStatus("loading");
      const response = await fetch("/api/dokonano/scatter", { method: "GET", cache: "no-store" });
      const payload = (await response.json()) as DokonanoApiResponse;
      if (!response.ok) {
        setStatus("error");
        setMessage(payload.error ?? "Unknown error");
        return;
      }
      setPoints(payload.points ?? []);
      setMeta(
        payload.meta ?? {
          totalGroups: 0,
          p95Votes: 1,
          weights: { spotify: 0.6, vote: 0.4 },
        }
      );
      setStatus("idle");
    };

    run().catch((error: unknown) => {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unknown error");
    });
  }, []);

  const normalizedQuery = searchText.trim().toLowerCase();
  const searched = useMemo(() => {
    if (!normalizedQuery) return points;
    return points.filter((point) => point.name.toLowerCase().includes(normalizedQuery));
  }, [normalizedQuery, points]);

  const filtered = useMemo(() => {
    if (!showKaiwaiOnly || !selectedGroupId || kaiwaiStatus !== "idle") return searched;
    const allow = new Set(kaiwaiGroupIds);
    allow.add(selectedGroupId);
    return searched.filter((point) => allow.has(point.groupId));
  }, [kaiwaiGroupIds, kaiwaiStatus, searched, selectedGroupId, showKaiwaiOnly]);

  const selected = useMemo(() => {
    if (!selectedGroupId) return null;
    return points.find((point) => point.groupId === selectedGroupId) ?? null;
  }, [points, selectedGroupId]);

  const xMax = useMemo(
    () => Math.max(1, ...filtered.map((point) => point.careerMonths)),
    [filtered]
  );
  const yMax = useMemo(
    () => Math.max(1, ...filtered.map((point) => point.attentionScore)),
    [filtered]
  );

  const chartData = useMemo(
    () =>
      filtered.map((point) => ({
        value: [point.careerMonths, point.attentionScore],
        groupId: point.groupId,
        name: point.name,
        artistPopularity: point.artistPopularity,
        voteCount: point.voteCount,
        freshnessDays: point.freshnessDays,
        freshnessBand: point.freshnessBand,
        activityStartedMonth: point.activityStartedMonth,
        nandatteHref: point.nandatteHref,
        itemStyle: { color: FRESHNESS_COLOR[point.freshnessBand], opacity: 0.78 },
      })),
    [filtered]
  );

  const selectedChartData = useMemo(() => {
    if (!selected) return [];
    return [
      {
        value: [selected.careerMonths, selected.attentionScore],
        groupId: selected.groupId,
        name: selected.name,
        itemStyle: { color: "#111827", borderColor: "#f97316", borderWidth: 2 },
      },
    ];
  }, [selected]);

  const chartOption = useMemo(
    () => ({
      animation: false,
      grid: { top: 56, left: 60, right: 20, bottom: 64 },
      tooltip: {
        trigger: "item",
        confine: true,
        enterable: true,
        formatter: (params: { data?: Record<string, unknown> }) => {
          const data = params.data ?? {};
          const name = escapeHtml(String(data.name ?? "-"));
          const careerMonths = Number((data.value as number[] | undefined)?.[0] ?? 0);
          const attentionScore = Number((data.value as number[] | undefined)?.[1] ?? 0);
          const popularity = Number(data.artistPopularity ?? 0);
          const votes = Number(data.voteCount ?? 0);
          const freshnessDays = Number(data.freshnessDays ?? 9999);
          const href = typeof data.nandatteHref === "string" ? data.nandatteHref : null;
          const link = href
            ? `<a href="${href}" target="_blank" rel="noreferrer" style="text-decoration:underline">ナンダッテを見る</a>`
            : "ナンダッテリンクなし";
          return [
            `<div style="min-width:180px">`,
            `<div style="font-weight:700;margin-bottom:4px">${name}</div>`,
            `<div>キャリア: ${careerMonths}ヶ月</div>`,
            `<div>注目度: ${attentionScore.toFixed(2)}</div>`,
            `<div>artist_popularity: ${popularity.toFixed(1)}</div>`,
            `<div>votes: ${votes}</div>`,
            `<div>鮮度: ${freshnessDays}日前</div>`,
            `<div style="margin-top:6px">${link}</div>`,
            `</div>`,
          ].join("");
        },
      },
      xAxis: {
        type: "value",
        min: 0,
        max: Math.ceil(xMax * 1.1),
      },
      yAxis: {
        type: "value",
        min: 0,
        max: Math.ceil(yMax * 1.1),
      },
      dataZoom: [
        { type: "inside", xAxisIndex: 0, yAxisIndex: 0 },
        { type: "slider", xAxisIndex: 0, bottom: 24 },
      ],
      series: [
        {
          type: "scatter",
          data: chartData,
          symbolSize: 10,
          label: {
            show: true,
            position: "top",
            color: "#3f3f46",
            fontSize: 11,
            formatter: (params: { data?: Record<string, unknown> }) => String(params.data?.name ?? ""),
          },
          emphasis: { itemStyle: { opacity: 1 } },
        },
        {
          type: "scatter",
          data: selectedChartData,
          symbolSize: 16,
          z: 5,
        },
      ],
    }),
    [chartData, selectedChartData, xMax, yMax]
  );

  const onEvents = useMemo(
    () => ({
      click: (params: { data?: Record<string, unknown> }) => {
        const groupId = params.data?.groupId;
        if (typeof groupId === "string" && groupId.length > 0) {
          setSelectedGroupId(groupId);
        }
      },
    }),
    []
  );

  useEffect(() => {
    if (!showKaiwaiOnly || !selected?.groupId) return;

    const controller = new AbortController();
    const run = async () => {
      setKaiwaiStatus("loading");
      setKaiwaiMessage("");
      const response = await fetch(`/api/kaiwai/related?groupId=${encodeURIComponent(selected.groupId)}`, {
        method: "GET",
        cache: "no-store",
        signal: controller.signal,
      });
      const payload = (await response.json()) as KaiwaiRelatedApiResponse;
      if (!response.ok) {
        setKaiwaiStatus("error");
        setKaiwaiMessage(payload.error ?? "Failed to fetch kaiwai");
        return;
      }
      setKaiwaiGroupIds((payload.items ?? []).map((item) => item.groupId));
      setKaiwaiStatus("idle");
    };

    run().catch((error: unknown) => {
      if (controller.signal.aborted) return;
      setKaiwaiStatus("error");
      setKaiwaiMessage(error instanceof Error ? error.message : "Failed to fetch kaiwai");
    });

    return () => {
      controller.abort();
    };
  }, [selected?.groupId, showKaiwaiOnly]);

  if (status === "error") {
    return (
      <section className="rounded-2xl border border-red-400/40 bg-red-500/10 p-4 text-sm text-red-100">
        読み込みに失敗しました: {message}
      </section>
    );
  }

  return (
    <div className="grid gap-6">
      <section className="hidden grid-cols-[minmax(0,1fr)_320px] gap-4 md:grid">
        <div>
          <div className="relative py-2">
            <div className="absolute right-3 top-3 z-10 rounded-md border border-[var(--ui-border)] bg-[var(--ui-panel)] px-2 py-1 text-xs text-[var(--ui-text-muted)]">
              X: キャリア（月） / Y: 注目度
            </div>
            {status === "loading" ? (
              <div className="grid h-[560px] place-items-center text-sm text-[var(--ui-text-muted)]">読み込み中...</div>
            ) : (
              <ReactECharts option={chartOption} style={{ height: 560, width: "100%" }} onEvents={onEvents} />
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-xs text-[var(--ui-text-muted)]">
            <span>全体件数: {points.length}</span>
            <span>w_spotify: {meta.weights.spotify}</span>
            <span>w_vote: {meta.weights.vote}</span>
            <span>P95(votes): {meta.p95Votes}</span>
          </div>
        </div>

        <aside className="rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-panel)] p-4">
          <label htmlFor="dokonano-search-desktop" className="mb-2 block text-xs font-semibold text-[var(--ui-text-subtle)]">
            グループ名検索
          </label>
          <input
            id="dokonano-search-desktop"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="例: ava, きゅるりん"
            className="mb-4 w-full rounded-xl border border-[var(--ui-border)] bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500"
          />

          <h2 className="font-mincho-jp text-xl font-semibold">選択中グループ</h2>
          {selected ? (
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <p className="min-w-0 truncate text-base font-semibold">{selected.name}</p>
                <button
                  type="button"
                  onClick={() => {
                    setShowKaiwaiOnly((prev) => {
                      const next = !prev;
                      if (!next) {
                        setKaiwaiStatus("idle");
                        setKaiwaiMessage("");
                        setKaiwaiGroupIds([]);
                      }
                      return next;
                    });
                  }}
                  className={`shrink-0 rounded-full border px-3 py-1 text-xs ${
                    showKaiwaiOnly
                      ? "border-red-700 bg-red-700 text-white"
                      : "border-[var(--ui-border)]"
                  }`}
                >
                  カイワイ
                </button>
              </div>
              <p>キャリア: {selected.careerMonths}ヶ月</p>
              <p>注目度: {selected.attentionScore.toFixed(2)}</p>
              <p>artist_popularity: {selected.artistPopularity.toFixed(1)}</p>
              <p>votes: {selected.voteCount}</p>
              <p style={{ color: FRESHNESS_COLOR[selected.freshnessBand], fontWeight: 700 }}>
                鮮度（{selected.freshnessDays}日前）
              </p>
              {selected.nandatteHref ? (
                <Link href={selected.nandatteHref} className="block underline underline-offset-2">
                  ナンダッテページへ
                </Link>
              ) : null}
              {showKaiwaiOnly && kaiwaiStatus === "loading" ? (
                <p className="text-xs text-[var(--ui-text-muted)]">カイワイを取得中...</p>
              ) : null}
              {showKaiwaiOnly && kaiwaiStatus === "error" ? (
                <p className="text-xs text-red-400">カイワイ取得失敗: {kaiwaiMessage}</p>
              ) : null}
            </div>
          ) : (
            <p className="mt-3 text-sm text-[var(--ui-text-muted)]">点をクリックすると詳細が表示されます。</p>
          )}

          <div className="mt-6 space-y-1 text-xs text-[var(--ui-text-muted)]">
            <p className="font-semibold text-[var(--ui-text-subtle)]">鮮度カラー</p>
            <p><span className="inline-block h-2 w-2 bg-[#ef4444] mr-2" />0-1日</p>
            <p><span className="inline-block h-2 w-2 bg-[#f97316] mr-2" />2日</p>
            <p><span className="inline-block h-2 w-2 bg-[#eab308] mr-2" />3-4日</p>
            <p><span className="inline-block h-2 w-2 bg-[#22c55e] mr-2" />5-7日</p>
            <p><span className="inline-block h-2 w-2 bg-[#3b82f6] mr-2" />8日以上</p>
          </div>
        </aside>
      </section>

      <section className="grid gap-4 md:hidden">
        <div className="rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-panel)] p-4">
          <label htmlFor="dokonano-search-mobile" className="mb-2 block text-xs font-semibold text-[var(--ui-text-subtle)]">
            グループ名検索
          </label>
          <input
            id="dokonano-search-mobile"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="例: ava, きゅるりん"
            className="mb-3 w-full rounded-xl border border-[var(--ui-border)] bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500"
          />
          <ul className="grid gap-2">
            {filtered.slice(0, 30).map((point) => (
              <li key={point.groupId}>
                <button
                  type="button"
                  onClick={() => setSelectedGroupId(point.groupId)}
                  className={`w-full rounded-xl border px-3 py-2 text-left ${
                    selectedGroupId === point.groupId
                      ? "border-zinc-500 bg-zinc-500/10"
                      : "border-[var(--ui-border)]"
                  }`}
                >
                  <p className="text-sm font-semibold">{point.name}</p>
                  <p className="text-xs text-[var(--ui-text-muted)]">
                    career {point.careerMonths}m / score {point.attentionScore.toFixed(1)}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="relative py-2">
          <div className="absolute right-3 top-3 z-10 rounded-md border border-[var(--ui-border)] bg-[var(--ui-panel)] px-2 py-1 text-[11px] text-[var(--ui-text-muted)]">
            X: キャリア（月） / Y: 注目度
          </div>
          {status === "loading" ? (
            <div className="grid h-[420px] place-items-center text-sm text-[var(--ui-text-muted)]">読み込み中...</div>
          ) : (
            <ReactECharts option={chartOption} style={{ height: 420, width: "100%" }} onEvents={onEvents} />
          )}
        </div>
      </section>
    </div>
  );
}
