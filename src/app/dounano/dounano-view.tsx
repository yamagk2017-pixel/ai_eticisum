"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

type DounanoPoint = {
  groupId: string;
  name: string;
  slug: string | null;
  nandatteHref: string | null;
  popularity: number;
  voteCount: number;
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

function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function DounanoView() {
  const [points, setPoints] = useState<DounanoPoint[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [searchText, setSearchText] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [showMobileChart, setShowMobileChart] = useState(false);
  const [median, setMedian] = useState({ popularity: 0, voteCount: 0 });
  const [meta, setMeta] = useState({
    totalGroups: 0,
    totalVotes: 0,
    totalNarrativeItems: 0,
    avgItemsPerVote: 0,
  });

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
  const filtered = useMemo(() => {
    if (!normalizedQuery) return points;
    return points.filter((point) => point.name.toLowerCase().includes(normalizedQuery));
  }, [normalizedQuery, points]);

  const selected = useMemo(() => {
    if (!selectedGroupId) return null;
    return filtered.find((point) => point.groupId === selectedGroupId) ?? null;
  }, [filtered, selectedGroupId]);

  const chartData = useMemo(
    () =>
      filtered.map((point) => ({
        value: [point.popularity - median.popularity, point.voteCount - median.voteCount],
        groupId: point.groupId,
        name: point.name,
        popularity: point.popularity,
        voteCount: point.voteCount,
        centeredX: point.popularity - median.popularity,
        centeredY: point.voteCount - median.voteCount,
        nandatteHref: point.nandatteHref,
      })),
    [filtered, median.popularity, median.voteCount]
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
      grid: { top: 52, left: 56, right: 30, bottom: 64 },
      tooltip: {
        trigger: "item",
        enterable: true,
        confine: true,
        formatter: (params: { data?: Record<string, unknown> }) => {
          const data = params.data ?? {};
          const name = escapeHtml(String(data.name ?? "-"));
          const popularity = Number(data.popularity ?? 0);
          const voteCount = Number(data.voteCount ?? 0);
          const centeredX = Number(data.centeredX ?? 0);
          const centeredY = Number(data.centeredY ?? 0);
          const href = typeof data.nandatteHref === "string" ? data.nandatteHref : null;
          const link = href
            ? `<a href="${href}" target="_blank" rel="noreferrer" style="text-decoration:underline">ナンダッテを見る</a>`
            : "ナンダッテリンクなし";
          return [
            `<div style="min-width:180px">`,
            `<div style="font-weight:700;margin-bottom:4px">${name}</div>`,
            `<div>artist_popularity: ${popularity.toFixed(1)}</div>`,
            `<div>魅力への投票総数: ${voteCount}</div>`,
            `<div>中心化X: ${centeredX.toFixed(1)}</div>`,
            `<div>中心化Y: ${centeredY.toFixed(1)}</div>`,
            `<div style="margin-top:6px">${link}</div>`,
            `</div>`,
          ].join("");
        },
      },
      xAxis: {
        type: "value",
        min: -axisRange.x,
        max: axisRange.x,
      },
      yAxis: {
        type: "value",
        min: -axisRange.y,
        max: axisRange.y,
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
          itemStyle: { color: "#0284c7", opacity: 0.72 },
          emphasis: { itemStyle: { color: "#0369a1", opacity: 1 } },
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
          symbolSize: 16,
          itemStyle: { color: "#f97316" },
          z: 5,
        },
      ],
    }),
    [axisRange.x, axisRange.y, chartData, selectedChartData]
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
        <div className="rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-panel)] p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="font-mincho-jp text-xl font-semibold">検索結果</h2>
            <button
              type="button"
              onClick={() => setShowMobileChart((value) => !value)}
              className="rounded-full border border-[var(--ui-border)] px-3 py-1 text-xs"
            >
              {showMobileChart ? "マップを隠す" : "マップを表示"}
            </button>
          </div>
          {status === "loading" ? <p className="text-sm text-[var(--ui-text-muted)]">読み込み中...</p> : null}
          <label htmlFor="dounano-search-mobile" className="mb-2 block text-xs font-semibold text-[var(--ui-text-subtle)]">
            グループ名検索
          </label>
          <input
            id="dounano-search-mobile"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="例: きゅるりん、femme fatale"
            className="mb-3 w-full rounded-xl border border-[var(--ui-border)] bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500"
          />
          {status === "idle" && filtered.length === 0 ? (
            <p className="text-sm text-[var(--ui-text-muted)]">該当するグループがありません。</p>
          ) : null}
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
                    popularity {point.popularity.toFixed(1)} / 票 {point.voteCount}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </div>

        {showMobileChart ? (
          <div>
            <div className="relative rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-panel)] p-2">
            <div className="absolute right-3 top-3 z-10 rounded-md border border-[var(--ui-border)] bg-[var(--ui-panel)] px-2 py-1 text-[11px] text-[var(--ui-text-muted)]">
              X: 音楽接触度 / Y: ナラティブ密度
            </div>
            <ReactECharts option={chartOption} style={{ height: 420, width: "100%" }} onEvents={onEvents} />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-xs text-[var(--ui-text-muted)]">
              <span>全体件数: {points.length}</span>
              <span>投票数: {meta.totalVotes}</span>
              <span>魅力総投票数: {meta.totalNarrativeItems}</span>
              <span>1投票あたり平均件数: {meta.avgItemsPerVote.toFixed(2)}</span>
            </div>
          </div>
        ) : null}
      </section>

      <section className="hidden grid-cols-[minmax(0,1fr)_320px] gap-4 md:grid">
        <div>
          <div className="relative rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-panel)] p-2">
            <div className="absolute right-3 top-3 z-10 rounded-md border border-[var(--ui-border)] bg-[var(--ui-panel)] px-2 py-1 text-xs text-[var(--ui-text-muted)]">
              X: 音楽接触度 / Y: ナラティブ密度
            </div>
            {status === "loading" ? (
              <div className="grid h-[560px] place-items-center text-sm text-[var(--ui-text-muted)]">読み込み中...</div>
            ) : (
              <ReactECharts option={chartOption} style={{ height: 560, width: "100%" }} onEvents={onEvents} />
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-xs text-[var(--ui-text-muted)]">
            <span>全体件数: {points.length}</span>
            <span>投票数: {meta.totalVotes}</span>
            <span>魅力総投票数: {meta.totalNarrativeItems}</span>
            <span>1投票あたり平均件数: {meta.avgItemsPerVote.toFixed(2)}</span>
          </div>
        </div>

        <aside className="rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-panel)] p-4">
          <label htmlFor="dounano-search-desktop" className="mb-2 block text-xs font-semibold text-[var(--ui-text-subtle)]">
            グループ名検索
          </label>
          <input
            id="dounano-search-desktop"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="例: きゅるりん、femme fatale"
            className="mb-4 w-full rounded-xl border border-[var(--ui-border)] bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500"
          />
          <h2 className="font-mincho-jp text-xl font-semibold">選択中グループ</h2>
          {selected ? (
            <div className="mt-3 space-y-2 text-sm">
              <p className="text-base font-semibold">{selected.name}</p>
              <p>artist_popularity: {selected.popularity.toFixed(1)}</p>
              <p>魅力への投票総数: {selected.voteCount}</p>
              {selected.nandatteHref ? (
                <Link href={selected.nandatteHref} className="inline-block underline underline-offset-2">
                  ナンダッテページへ
                </Link>
              ) : (
                <p className="text-[var(--ui-text-muted)]">ナンダッテリンク未登録</p>
              )}
            </div>
          ) : (
            <p className="mt-3 text-sm text-[var(--ui-text-muted)]">
              点をクリックすると詳細が表示されます。
            </p>
          )}
        </aside>
      </section>
    </div>
  );
}
