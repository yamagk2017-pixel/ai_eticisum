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
  const [kaiwaiMessage, setKaiwaiMessage] = useState("");
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

  useEffect(() => {
    const onDocumentClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const button = target.closest<HTMLButtonElement>("[data-kaiwai-toggle='1']");
      if (!button) return;

      event.preventDefault();
      event.stopPropagation();

      const groupId = button.dataset.groupId;
      if (!groupId) return;
      const next = !showKaiwaiOnly;
      button.style.borderColor = next ? "#b91c1c" : "#d4d4d8";
      button.style.background = next ? "#dc2626" : "transparent";
      button.style.color = next ? "#ffffff" : "#3f3f46";
      button.dataset.kaiwaiOn = next ? "1" : "0";

      setSelectedGroupId(groupId);
      setShowKaiwaiOnly(next);
      if (!next) {
        setKaiwaiStatus("idle");
        setKaiwaiMessage("");
        setKaiwaiGroupIds([]);
      }
    };

    document.addEventListener("click", onDocumentClick);
    return () => {
      document.removeEventListener("click", onDocumentClick);
    };
  }, [showKaiwaiOnly]);

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
      grid: { top: 56, left: 20, right: 8, bottom: 40, containLabel: true },
      tooltip: {
        trigger: "item",
        confine: true,
        enterable: true,
        formatter: (params: { data?: Record<string, unknown> }) => {
          const data = params.data ?? {};
          const name = escapeHtml(String(data.name ?? "-"));
          const groupId = escapeHtml(String(data.groupId ?? ""));
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
          const kaiwaiButton = isMobileViewport
            ? `<div style="margin-top:6px"><button type="button" data-kaiwai-toggle="1" data-group-id="${groupId}" style="border:1px solid ${showKaiwaiOnly ? "#b91c1c" : "#d4d4d8"};background:${showKaiwaiOnly ? "#dc2626" : "transparent"};color:${showKaiwaiOnly ? "#ffffff" : "#3f3f46"};border-radius:9999px;padding:2px 10px;font-size:12px;font-weight:700;cursor:pointer">カイワイ</button></div>`
            : "";
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
            kaiwaiButton,
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
          symbolSize: isMobileViewport ? 24 : 16,
          z: 5,
        },
      ],
    }),
    [chartData, isMobileViewport, isProduction, selectedChartData, showKaiwaiOnly, xMax, yMax]
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
      <section className="hidden gap-6 md:grid">
        <div>
          <div className="relative pt-2">
            <div className="absolute right-3 top-3 z-10 rounded-md border border-[var(--ui-border)] bg-[var(--ui-panel)] px-2 py-1 text-xs text-[var(--ui-text-muted)]">
              横軸(X)：キャリア（月）／縦軸(Y)：注目度
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

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <aside className="p-0">
          <h2 className="mb-2 font-mincho-jp text-xl font-semibold">グループ名検索</h2>
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
              <p style={{ color: FRESHNESS_COLOR[selected.freshnessBand], fontWeight: 700 }}>
                鮮度（{selected.freshnessDays}日前）
              </p>
              <p>
                キャリア: {selected.careerMonths}ヶ月
                {selected.activityStartedMonth
                  ? `（${new Date(selected.activityStartedMonth).getFullYear()}年${String(
                      new Date(selected.activityStartedMonth).getMonth() + 1
                    ).padStart(2, "0")}月から）`
                  : "（開始月未設定）"}
              </p>
              <p>注目度: {selected.attentionScore.toFixed(2)}</p>
              {!isProduction ? <p>artist_popularity: {selected.artistPopularity.toFixed(1)}</p> : null}
              {!isProduction ? <p>votes: {selected.voteCount}</p> : null}
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
          </aside>

          <div>
            <h3 className="font-mincho-jp text-lg font-semibold">ホットアイドル</h3>
            {hotIdols.length === 0 ? (
              <p className="mt-2 text-xs text-[var(--ui-text-muted)]">データがありません。</p>
            ) : (
              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
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
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:hidden">
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
        <div className="relative pt-2">
          <div className="absolute right-3 top-3 z-10 rounded-md border border-[var(--ui-border)] bg-[var(--ui-panel)] px-2 py-1 text-[11px] text-[var(--ui-text-muted)]">
            横軸(X)：キャリア（月）／縦軸(Y)：注目度
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
