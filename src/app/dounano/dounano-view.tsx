"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

type DounanoPoint = {
  groupId: string;
  name: string;
  slug: string | null;
  nandatteHref: string | null;
  popularity: number;
  voteCount: number;
  freshnessDays: number;
  freshnessBand: "hot" | "warm" | "active" | "cool" | "stale";
};

const FRESHNESS_COLOR: Record<DounanoPoint["freshnessBand"], string> = {
  hot: "#ef4444",
  warm: "#f97316",
  active: "#eab308",
  cool: "#22c55e",
  stale: "#3b82f6",
};

type DounanoApiResponse = {
  points?: DounanoPoint[];
  median?: {
    popularity: number;
    voteCount: number;
  };
  meta?: {
    totalGroups: number;
    totalVotes: number;
    totalNarrativeItems: number;
    avgItemsPerVote: number;
  };
  popularitySourceTable?: string | null;
  generatedAt?: string;
  error?: string;
};

type Status = "idle" | "loading" | "error";
type KaiwaiRelatedApiResponse = {
  baseGroupId?: string;
  items?: Array<{
    groupId: string;
    overlapUsers: number;
  }>;
  error?: string;
};

function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function DounanoView() {
  const isProduction = process.env.NODE_ENV === "production";
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [points, setPoints] = useState<DounanoPoint[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [searchText, setSearchText] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [median, setMedian] = useState({ popularity: 0, voteCount: 0 });
  const [meta, setMeta] = useState({
    totalGroups: 0,
    totalVotes: 0,
    totalNarrativeItems: 0,
    avgItemsPerVote: 0,
  });
  const [showKaiwaiOnly, setShowKaiwaiOnly] = useState(false);
  const [kaiwaiStatus, setKaiwaiStatus] = useState<Status>("idle");
  const [kaiwaiGroupIds, setKaiwaiGroupIds] = useState<string[]>([]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const apply = () => setIsMobileViewport(mediaQuery.matches);
    apply();
    mediaQuery.addEventListener("change", apply);
    return () => {
      mediaQuery.removeEventListener("change", apply);
    };
  }, []);

  const toggleKaiwaiOnly = () => {
    setShowKaiwaiOnly((prev) => {
      const next = !prev;
      if (!next) {
        setKaiwaiStatus("idle");
        setKaiwaiGroupIds([]);
      }
      return next;
    });
  };

  useEffect(() => {
    const run = async () => {
      setStatus("loading");
      const response = await fetch("/api/dounano/scatter", { method: "GET", cache: "no-store" });
      const payload = (await response.json()) as DounanoApiResponse;
      if (!response.ok) {
        setStatus("error");
        setMessage(payload.error ?? "Unknown error");
        return;
      }
      setPoints(payload.points ?? []);
      setMedian(payload.median ?? { popularity: 0, voteCount: 0 });
      setMeta(
        payload.meta ?? {
          totalGroups: 0,
          totalVotes: 0,
          totalNarrativeItems: 0,
          avgItemsPerVote: 0,
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
  const searchHitGroupIds = useMemo(() => {
    if (!normalizedQuery) return new Set<string>();
    return new Set(
      points
        .filter((point) => point.name.toLowerCase().includes(normalizedQuery))
        .map((point) => point.groupId)
    );
  }, [normalizedQuery, points]);

  const filtered = useMemo(() => {
    if (!showKaiwaiOnly || !selectedGroupId || kaiwaiStatus !== "idle") return points;
    const allow = new Set(kaiwaiGroupIds);
    allow.add(selectedGroupId);
    return points.filter((point) => allow.has(point.groupId));
  }, [kaiwaiGroupIds, kaiwaiStatus, points, selectedGroupId, showKaiwaiOnly]);

  const selected = useMemo(() => {
    if (!selectedGroupId) return null;
    return filtered.find((point) => point.groupId === selectedGroupId) ?? null;
  }, [filtered, selectedGroupId]);

  const hotIdols = useMemo(() => {
    return [...points]
      .sort((a, b) => {
        if (a.freshnessDays !== b.freshnessDays) return a.freshnessDays - b.freshnessDays;
        if (b.voteCount !== a.voteCount) return b.voteCount - a.voteCount;
        return a.name.localeCompare(b.name, "ja");
      })
      .slice(0, 5);
  }, [points]);

  const chartData = useMemo(
    () =>
      filtered.map((point) => ({
        value: [point.popularity - median.popularity, point.voteCount - median.voteCount],
        groupId: point.groupId,
        name: point.name,
        popularity: point.popularity,
        voteCount: point.voteCount,
        freshnessDays: point.freshnessDays,
        freshnessBand: point.freshnessBand,
        centeredX: point.popularity - median.popularity,
        centeredY: point.voteCount - median.voteCount,
        nandatteHref: point.nandatteHref,
        symbolSize: searchHitGroupIds.has(point.groupId) ? 32 : 10,
        itemStyle: { color: FRESHNESS_COLOR[point.freshnessBand], opacity: 0.8 },
      })),
    [filtered, median.popularity, median.voteCount, searchHitGroupIds]
  );

  const selectedChartData = useMemo(() => {
    if (!selected) return [];
    return [
      {
        value: [selected.popularity - median.popularity, selected.voteCount - median.voteCount],
        groupId: selected.groupId,
        name: selected.name,
        popularity: selected.popularity,
        voteCount: selected.voteCount,
        freshnessDays: selected.freshnessDays,
        freshnessBand: selected.freshnessBand,
        centeredX: selected.popularity - median.popularity,
        centeredY: selected.voteCount - median.voteCount,
        nandatteHref: selected.nandatteHref,
      },
    ];
  }, [selected, median.popularity, median.voteCount]);

  const axisRange = useMemo(() => {
    const maxAbsX = Math.max(
      1,
      ...chartData.map((item) => Math.abs(Number(item.centeredX ?? 0)))
    );
    const maxAbsY = Math.max(
      1,
      ...chartData.map((item) => Math.abs(Number(item.centeredY ?? 0)))
    );
    const x = Math.ceil(maxAbsX * 1.1);
    const y = Math.ceil(maxAbsY * 1.1);
    return { x, y };
  }, [chartData]);

  const chartOption = useMemo(
    () => ({
      animation: false,
      grid: { top: isMobileViewport ? 52 : 130, left: 20, right: 8, bottom: 40, containLabel: true },
      tooltip: {
        trigger: "item",
        enterable: true,
        confine: true,
        formatter: (params: { data?: Record<string, unknown> }) => {
          const data = params.data ?? {};
          const name = escapeHtml(String(data.name ?? "-"));
          const popularity = Number(data.popularity ?? 0);
          const voteCount = Number(data.voteCount ?? 0);
          const freshnessDays = Number(data.freshnessDays ?? 9999);
          const freshnessBand = (data.freshnessBand as DounanoPoint["freshnessBand"] | undefined) ?? "stale";
          const centeredX = Number(data.centeredX ?? 0);
          const centeredY = Number(data.centeredY ?? 0);
          const freshnessColor = FRESHNESS_COLOR[freshnessBand] ?? FRESHNESS_COLOR.stale;
          const href =
            typeof data.nandatteHref === "string" && data.nandatteHref.length > 0
              ? escapeHtml(data.nandatteHref)
              : null;
          const titleLine = href
            ? `<a href="${href}" target="_blank" rel="noreferrer" style="font-weight:700;margin-bottom:4px;display:inline-block;text-decoration:underline;color:#3f3f46">${name}</a>`
            : `<div style="font-weight:700;margin-bottom:4px;color:#3f3f46">${name}</div>`;
          return [
            `<div style="min-width:180px">`,
            titleLine,
            isProduction ? "" : `<div>artist_popularity: ${popularity.toFixed(1)}</div>`,
            isProduction ? "" : `<div>魅力への投票総数: ${voteCount}</div>`,
            `<div style="color:${freshnessColor};font-weight:700">鮮度（${freshnessDays}日前）</div>`,
            `<div>イマキテ指数: ${centeredX.toFixed(1)}</div>`,
            `<div>ナンダテ指数: ${centeredY.toFixed(1)}</div>`,
            `</div>`,
          ].join("");
        },
      },
      xAxis: {
        type: "value",
        min: -axisRange.x,
        max: axisRange.x,
        axisLabel: {
          margin: 6,
        },
      },
      yAxis: {
        type: "value",
        min: -axisRange.y,
        max: axisRange.y,
        axisLabel: {
          inside: false,
          margin: 8,
        },
      },
      dataZoom: [
        {
          type: "inside",
          xAxisIndex: 0,
          filterMode: "none",
          zoomOnMouseWheel: true,
          moveOnMouseMove: true,
          moveOnMouseWheel: false,
        },
        {
          type: "inside",
          yAxisIndex: 0,
          filterMode: "none",
          zoomOnMouseWheel: true,
          moveOnMouseMove: true,
          moveOnMouseWheel: false,
        },
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
          markLine: {
            silent: true,
            symbol: "none",
            lineStyle: { color: "#71717a", type: "dashed", width: 1 },
            label: { show: false },
            data: [
              { name: "X=0", xAxis: 0 },
              { name: "Y=0", yAxis: 0 },
            ],
          },
        },
        {
          type: "scatter",
          data: selectedChartData,
          symbolSize: isMobileViewport ? 48 : 32,
          itemStyle: { color: "#f97316" },
          z: 5,
        },
      ],
    }),
    [axisRange.x, axisRange.y, chartData, isMobileViewport, isProduction, selectedChartData]
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
      const response = await fetch(`/api/kaiwai/related?groupId=${encodeURIComponent(selected.groupId)}`, {
        method: "GET",
        cache: "no-store",
        signal: controller.signal,
      });
      const payload = (await response.json()) as KaiwaiRelatedApiResponse;
      if (!response.ok) {
        setKaiwaiStatus("error");
        return;
      }
      setKaiwaiGroupIds((payload.items ?? []).map((item) => item.groupId));
      setKaiwaiStatus("idle");
    };

    run().catch(() => {
      if (controller.signal.aborted) return;
      setKaiwaiStatus("error");
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
      <section className="grid gap-4 md:hidden">
        <div>
          <div className="flex items-end justify-between gap-3">
            <div className="w-full">
              <h2 className="mb-2 font-mincho-jp text-lg font-semibold">グループ名検索</h2>
              <input
                id="dounano-search-mobile"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="例: きゅるりん、femme fatale"
                className="w-full rounded-xl border border-[var(--ui-border)] bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500"
              />
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="text-xs text-[var(--ui-text-muted)]">カイワイレーダー：</span>
              <button
                type="button"
                onClick={toggleKaiwaiOnly}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                  showKaiwaiOnly
                    ? "border-red-700 bg-red-700 text-white hover:bg-red-600"
                    : "border-zinc-300 bg-zinc-200 text-zinc-500 hover:bg-zinc-300"
                }`}
              >
                {"ON"}
              </button>
            </div>
          </div>
          {selected && showKaiwaiOnly && kaiwaiStatus === "loading" ? (
            <p className="mt-1 text-xs text-[var(--ui-text-muted)]">カイワイを取得中...</p>
          ) : null}
          {selected && showKaiwaiOnly && kaiwaiStatus === "error" ? (
            <p className="mt-1 text-xs text-red-400">カイワイ取得失敗</p>
          ) : null}
          <div className="mt-2 flex justify-end">
            <p className="px-2 py-1 text-[11px] text-[var(--ui-text-muted)]">
              ＜横軸(X)：イマキテ指数／縦軸(Y)：ナンダテ指数＞
            </p>
          </div>
        </div>
        <div>
          <h3 className="font-mincho-jp text-lg font-semibold">ホットアイドル</h3>
          {hotIdols.length === 0 ? (
            <p className="mt-2 text-xs text-[var(--ui-text-muted)]">データがありません。</p>
          ) : (
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              {hotIdols.map((item, index) => (
                <span key={`hot-idol-mobile-${item.groupId}`}>
                  <button
                    type="button"
                    onClick={() => setSelectedGroupId(item.groupId)}
                    className="text-left underline underline-offset-2"
                    style={{
                      color: FRESHNESS_COLOR[item.freshnessBand],
                      fontWeight: selectedGroupId === item.groupId ? 700 : 500,
                    }}
                  >
                    {index + 1}. {item.name}
                  </button>
                  {index < hotIdols.length - 1 ? <span className="ml-2 text-[var(--ui-text-muted)]">/</span> : null}
                </span>
              ))}
            </div>
          )}
        </div>
        <div>
          <div className="relative pt-1">
            {status === "loading" ? (
              <div className="grid h-[420px] place-items-center text-sm text-[var(--ui-text-muted)]">読み込み中...</div>
            ) : (
              <ReactECharts option={chartOption} style={{ height: 420, width: "100%" }} onEvents={onEvents} />
            )}
          </div>
          <div className="mt-0 px-1 text-xs text-[var(--ui-text-muted)] text-center">
            <p className="mb-1 font-semibold text-[var(--ui-text-subtle)]">鮮度カラー</p>
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
              <span><span className="mr-1 inline-block h-2 w-2 bg-[#ef4444]" />0-1日</span>
              <span><span className="mr-1 inline-block h-2 w-2 bg-[#f97316]" />2日</span>
              <span><span className="mr-1 inline-block h-2 w-2 bg-[#eab308]" />3-4日</span>
              <span><span className="mr-1 inline-block h-2 w-2 bg-[#22c55e]" />5-7日</span>
              <span><span className="mr-1 inline-block h-2 w-2 bg-[#3b82f6]" />8日以上</span>
            </div>
          </div>
          {!isProduction ? (
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-xs text-[var(--ui-text-muted)]">
              <span>全体件数: {points.length}</span>
              <span>投票数: {meta.totalVotes}</span>
              <span>魅力総投票数: {meta.totalNarrativeItems}</span>
              <span>1投票あたり平均件数: {meta.avgItemsPerVote.toFixed(2)}</span>
            </div>
          ) : null}
        </div>
      </section>

      <section className="hidden gap-6 md:grid">
        <div>
          <div className="relative pt-2">
            <div className="absolute inset-x-3 top-3 z-10">
              <div className="flex items-start justify-between gap-4">
                <div className="w-full max-w-xl">
                  <h2 className="mb-2 font-mincho-jp text-xl font-semibold">グループ名検索</h2>
                  <input
                    id="dounano-search-desktop"
                    value={searchText}
                    onChange={(event) => setSearchText(event.target.value)}
                    placeholder="例: きゅるりん、femme fatale"
                    className="w-full rounded-xl border border-[var(--ui-border)] bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500"
                  />
                  {selected && showKaiwaiOnly && kaiwaiStatus === "loading" ? (
                    <p className="mt-1 text-xs text-[var(--ui-text-muted)]">カイワイを取得中...</p>
                  ) : null}
                  {selected && showKaiwaiOnly && kaiwaiStatus === "error" ? (
                    <p className="mt-1 text-xs text-red-400">カイワイ取得失敗</p>
                  ) : null}
                </div>
                <div className="mt-9 flex items-center gap-2">
                  <span className="text-sm text-[var(--ui-text-muted)]">カイワイレーダー：</span>
                  <button
                    type="button"
                    onClick={toggleKaiwaiOnly}
                    className={`shrink-0 rounded-full border px-3 py-1 text-sm font-semibold transition ${
                      showKaiwaiOnly
                        ? "border-red-700 bg-red-700 text-white hover:bg-red-600"
                        : "border-zinc-300 bg-zinc-200 text-zinc-500 hover:bg-zinc-300"
                    }`}
                  >
                    {"ON"}
                  </button>
                </div>
              </div>
              <div className="mt-2 flex justify-end">
                <p className="px-2 py-1 text-sm text-[var(--ui-text-muted)]">
                  ＜横軸(X)：イマキテ指数／縦軸(Y)：ナンダテ指数＞
                </p>
              </div>
            </div>
            {status === "loading" ? (
              <div className="grid h-[560px] place-items-center text-sm text-[var(--ui-text-muted)]">読み込み中...</div>
            ) : (
              <ReactECharts option={chartOption} style={{ height: 560, width: "100%" }} onEvents={onEvents} />
            )}
            <div className="mt-0 px-1 text-xs text-[var(--ui-text-muted)] text-center">
              <p className="mb-1 font-semibold text-[var(--ui-text-subtle)]">鮮度カラー</p>
              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
              <span><span className="mr-1 inline-block h-2 w-2 bg-[#ef4444]" />0-1日</span>
              <span><span className="mr-1 inline-block h-2 w-2 bg-[#f97316]" />2日</span>
              <span><span className="mr-1 inline-block h-2 w-2 bg-[#eab308]" />3-4日</span>
              <span><span className="mr-1 inline-block h-2 w-2 bg-[#22c55e]" />5-7日</span>
              <span><span className="mr-1 inline-block h-2 w-2 bg-[#3b82f6]" />8日以上</span>
              </div>
            </div>
          </div>
          {!isProduction ? (
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-xs text-[var(--ui-text-muted)]">
              <span>全体件数: {points.length}</span>
              <span>投票数: {meta.totalVotes}</span>
              <span>魅力総投票数: {meta.totalNarrativeItems}</span>
              <span>1投票あたり平均件数: {meta.avgItemsPerVote.toFixed(2)}</span>
            </div>
          ) : null}
        </div>

        <aside className="rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-panel)] p-4">
          <h3 className="font-mincho-jp text-xl font-semibold">ホットアイドル</h3>
          {hotIdols.length === 0 ? (
            <p className="mt-2 text-xs text-[var(--ui-text-muted)]">データがありません。</p>
          ) : (
            <div className="mt-2 flex items-center gap-x-2 overflow-x-auto whitespace-nowrap text-base">
              {hotIdols.map((item, index) => (
                <span key={`hot-idol-desktop-${item.groupId}`}>
                  <button
                    type="button"
                    onClick={() => setSelectedGroupId(item.groupId)}
                    className="text-left underline underline-offset-2"
                    style={{
                      color: FRESHNESS_COLOR[item.freshnessBand],
                      fontWeight: selectedGroupId === item.groupId ? 700 : 500,
                    }}
                  >
                    {index + 1}. {item.name}
                  </button>
                  {index < hotIdols.length - 1 ? <span className="ml-2 text-[var(--ui-text-muted)]">/</span> : null}
                </span>
              ))}
            </div>
          )}
        </aside>
      </section>
    </div>
  );
}
