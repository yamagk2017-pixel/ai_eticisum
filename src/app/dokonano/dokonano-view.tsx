"use client";

import dynamic from "next/dynamic";
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

function formatActivityStartedMonthLabel(value: string | null): string | null {
  if (!value) return null;
  const matched = value.match(/^(\d{4})-(\d{2})/);
  if (matched) {
    return `${matched[1]}年${matched[2]}月`;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}年${String(date.getMonth() + 1).padStart(2, "0")}月`;
}

function toFreshnessLabel(days: unknown): string {
  const value = Number(days);
  if (!Number.isFinite(value) || value < 0) return "不明";
  return `${Math.floor(value)}日前`;
}

export function DokonanoView() {
  const isProduction = process.env.NODE_ENV === "production";
  const [isMobileViewport, setIsMobileViewport] = useState(false);
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
    return points.find((point) => point.groupId === selectedGroupId) ?? null;
  }, [points, selectedGroupId]);

  const hotIdols = useMemo(() => {
    return [...points]
      .sort((a, b) => {
        if (a.freshnessDays !== b.freshnessDays) return a.freshnessDays - b.freshnessDays;
        if (b.voteCount !== a.voteCount) return b.voteCount - a.voteCount;
        return a.name.localeCompare(b.name, "ja");
      })
      .slice(0, 5);
  }, [points]);

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
        symbolSize: searchHitGroupIds.has(point.groupId) ? 32 : 10,
        itemStyle: { color: FRESHNESS_COLOR[point.freshnessBand], opacity: 0.78 },
      })),
    [filtered, searchHitGroupIds]
  );

  const selectedChartData = useMemo(() => {
    if (!selected) return [];
    return [
      {
        value: [selected.careerMonths, selected.attentionScore],
        groupId: selected.groupId,
        name: selected.name,
        artistPopularity: selected.artistPopularity,
        voteCount: selected.voteCount,
        freshnessDays: selected.freshnessDays,
        freshnessBand: selected.freshnessBand,
        activityStartedMonth: selected.activityStartedMonth,
        nandatteHref: selected.nandatteHref,
        itemStyle: { color: "#111827", borderColor: "#f97316", borderWidth: 2 },
      },
    ];
  }, [selected]);

  const chartOption = useMemo(
    () => ({
      animation: false,
      grid: { top: isMobileViewport ? 10 : 130, left: 20, right: 8, bottom: 40, containLabel: true },
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
          const freshnessBand =
            typeof data.freshnessBand === "string" ? (data.freshnessBand as DokonanoPoint["freshnessBand"]) : "stale";
          const freshnessColor = FRESHNESS_COLOR[freshnessBand] ?? FRESHNESS_COLOR.stale;
          const freshnessLabel = toFreshnessLabel(data.freshnessDays);
          const activityStartedMonth =
            typeof data.activityStartedMonth === "string" ? data.activityStartedMonth : null;
          const startedLabel = formatActivityStartedMonthLabel(activityStartedMonth);
          const href =
            typeof data.nandatteHref === "string" && data.nandatteHref.length > 0
              ? escapeHtml(data.nandatteHref)
              : null;
          const titleLine = href
            ? `<a href="${href}" target="_blank" rel="noreferrer" style="font-weight:700;color:#3f3f46;margin-bottom:4px;display:inline-block;text-decoration:underline">${name}</a>`
            : `<div style="font-weight:700;color:#3f3f46;margin-bottom:4px">${name}</div>`;
          return [
            `<div style="min-width:180px">`,
            titleLine,
            `<div style="font-weight:700;color:${freshnessColor};margin-bottom:2px">鮮度（${freshnessLabel}）</div>`,
            `<div style="color:#6b7280">キャリア: ${careerMonths}ヶ月${startedLabel ? `（${startedLabel}〜）` : "（開始月未設定）"}</div>`,
            `<div style="color:#7c3aed">注目度: ${attentionScore.toFixed(2)}</div>`,
            ...(!isProduction
              ? [
                  `<div style="color:#6b7280">artist_popularity: ${popularity.toFixed(1)}</div>`,
                  `<div style="color:#6b7280">votes: ${votes}</div>`,
                ]
              : []),
            `</div>`,
          ].join("");
        },
      },
      xAxis: {
        type: "value",
        min: 0,
        max: Math.ceil(xMax * 1.1),
        axisLabel: {
          margin: 6,
        },
      },
      yAxis: {
        type: "value",
        min: 0,
        max: Math.ceil(yMax * 1.1),
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
        },
        {
          type: "scatter",
          data: selectedChartData,
          symbolSize: isMobileViewport ? 48 : 32,
          z: 5,
        },
      ],
    }),
    [chartData, isMobileViewport, isProduction, selectedChartData, xMax, yMax]
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
      <section className="hidden gap-6 md:grid">
        <div>
          <div className="relative pt-2">
            <div className="absolute inset-x-3 top-3 z-10">
              <div className="flex items-start justify-between gap-4">
                <div className="w-full max-w-xl">
                  <h2 className="mb-2 font-mincho-jp text-xl font-semibold">グループ名検索</h2>
                  <input
                    id="dokonano-search-desktop"
                    value={searchText}
                    onChange={(event) => setSearchText(event.target.value)}
                    placeholder="例: ava, きゅるりん"
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
                  ＜横軸(X)：活動期間（月）／縦軸(Y)：注目度＞
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
              <span>w_spotify: {meta.weights.spotify}</span>
              <span>w_vote: {meta.weights.vote}</span>
              <span>P95(votes): {meta.p95Votes}</span>
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

      <section className="grid min-w-0 gap-4 md:hidden">
        <div className="min-w-0">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0 w-full">
              <h2 className="mb-2 font-mincho-jp text-lg font-semibold">グループ名検索</h2>
              <input
                id="dokonano-search-mobile"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="例: ava, きゅるりん"
                className="w-full rounded-xl border border-[var(--ui-border)] bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500"
              />
            </div>
            <div className="flex items-center gap-2 self-end sm:self-auto">
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
              ＜横軸(X)：活動期間（月）／縦軸(Y)：注目度＞
            </p>
          </div>
        </div>
        <div className="relative min-w-0 overflow-hidden pt-1">
          {status === "loading" ? (
            <div className="grid h-[420px] place-items-center text-sm text-[var(--ui-text-muted)]">読み込み中...</div>
          ) : (
            <ReactECharts option={chartOption} style={{ height: 420, width: "100%", maxWidth: "100%" }} onEvents={onEvents} />
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
          {!isProduction ? (
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-xs text-[var(--ui-text-muted)]">
              <span>全体件数: {points.length}</span>
              <span>w_spotify: {meta.weights.spotify}</span>
              <span>w_vote: {meta.weights.vote}</span>
              <span>P95(votes): {meta.p95Votes}</span>
            </div>
          ) : null}
        </div>
        <aside className="min-w-0 rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-panel)] p-4">
          <h3 className="font-mincho-jp text-xl font-semibold">ホットアイドル</h3>
          {hotIdols.length === 0 ? (
            <p className="mt-2 text-xs text-[var(--ui-text-muted)]">データがありません。</p>
          ) : (
            <div className="mt-2 min-w-0 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
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
        </aside>
      </section>
    </div>
  );
}
