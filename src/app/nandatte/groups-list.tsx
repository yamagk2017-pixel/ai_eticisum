"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type GroupRow = {
  id: string | number;
  name_ja: string | null;
  slug: string | null;
};

const PAGE_SIZE = 20;
const INITIAL_FILTERS = [
  { key: "all", label: "すべて", pattern: null },
  { key: "number", label: "数字", pattern: "^[0-9０-９]" },
  { key: "ae", label: "A-E", pattern: "^[A-Ea-eＡ-Ｅａ-ｅ]" },
  { key: "fj", label: "F-J", pattern: "^[F-Jf-jＦ-Ｊｆ-ｊ]" },
  { key: "ko", label: "K-O", pattern: "^[K-Ok-oＫ-Ｏｋ-ｏ]" },
  { key: "pt", label: "P-T", pattern: "^[P-Tp-tＰ-Ｔｐ-ｔ]" },
  { key: "uz", label: "U-Z", pattern: "^[U-Zu-zＵ-Ｚｕ-ｚ]" },
  { key: "a", label: "あ", pattern: "^[あいうえおぁぃぅぇぉアイウエオァィゥェォヴゔ]" },
  { key: "ka", label: "か", pattern: "^[かきくけこがぎぐげごカキクケコガギグゲゴ]" },
  { key: "sa", label: "さ", pattern: "^[さしすせそざじずぜぞサシスセソザジズゼゾ]" },
  { key: "ta", label: "た", pattern: "^[たちつてとだぢづでどタチツテトダヂヅデド]" },
  { key: "na", label: "な", pattern: "^[なにぬねのナニヌネノ]" },
  { key: "ha", label: "は", pattern: "^[はひふへほばびぶべぼぱぴぷぺぽハヒフヘホバビブベボパピプペポ]" },
  { key: "ma", label: "ま", pattern: "^[まみむめもマミムメモ]" },
  { key: "ya", label: "や", pattern: "^[やゆよゃゅょヤユヨャュョ]" },
  { key: "ra", label: "ら", pattern: "^[らりるれろラリルレロ]" },
  { key: "wa", label: "わ", pattern: "^[わをんゎワヲンヮ]" },
] as const;

type InitialFilterKey = (typeof INITIAL_FILTERS)[number]["key"];

export function GroupsList() {
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState<string>("");
  const [registeredCount, setRegisteredCount] = useState<number | null>(null);
  const [search, setSearch] = useState<string>("");
  const [submittedSearch, setSubmittedSearch] = useState<string>("");
  const [initialFilter, setInitialFilter] = useState<InitialFilterKey>("all");
  const [hasSearched, setHasSearched] = useState<boolean>(false);
  const [page, setPage] = useState<number>(1);
  const [total, setTotal] = useState<number>(0);
  const searchRef = useRef<HTMLInputElement | null>(null);

  const pageCount = useMemo(() => {
    return Math.max(1, Math.ceil(total / PAGE_SIZE));
  }, [total]);

  useEffect(() => {
    if (page > pageCount) {
      setPage(pageCount);
    }
  }, [page, pageCount]);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  useEffect(() => {
    const run = async () => {
      const supabase = createClient();
      const { count, error } = await supabase
        .schema("imd")
        .from("groups")
        .select("id", { count: "exact", head: true });

      if (!error) {
        setRegisteredCount(count ?? null);
      }
    };

    run().catch(() => {
      setRegisteredCount(null);
    });
  }, []);

  useEffect(() => {
    if (!hasSearched) {
      return;
    }

    const run = async () => {
      setStatus("loading");
      const supabase = createClient();
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .schema("imd")
        .from("groups")
        .select("id,name_ja,slug", { count: "exact" });

      if (submittedSearch.trim()) {
        query = query.ilike("name_ja", `%${submittedSearch.trim()}%`);
      }

      const selectedFilter = INITIAL_FILTERS.find((item) => item.key === initialFilter);
      if (selectedFilter?.pattern) {
        query = query.filter("name_ja", "match", selectedFilter.pattern);
      }

      query = query.order("name_ja", { ascending: true }).range(from, to);

      const { data, error, count } = await query;

      if (error) {
        setStatus("error");
        setMessage(error.message);
        return;
      }

      setGroups(data ?? []);
      setTotal(count ?? 0);
      setStatus("idle");
    };

    run().catch((err: unknown) => {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Unknown error");
    });
  }, [page, submittedSearch, initialFilter, hasSearched]);

  useEffect(() => {
    if (status === "idle") {
      searchRef.current?.focus();
    }
  }, [status]);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-semibold">グループ検索</h2>
            {registeredCount !== null && (
                <span className="rounded-full border border-zinc-700 bg-zinc-950 px-3 py-1 text-xs text-zinc-300">
                登録グループ{registeredCount.toLocaleString("ja-JP")}組
                </span>
              )}
          </div>
          <p className="mt-2 text-xs text-zinc-400">
            {hasSearched ? `全${total}件 / ${page}ページ目` : "グループ名 or 頭文字で検索"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-300">
          <form
            className="flex items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              setHasSearched(true);
              setPage(1);
              setSubmittedSearch(search);
            }}
          >
            <input
              ref={searchRef}
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
              }}
              className="w-48 rounded-full border border-zinc-700 bg-zinc-950 px-4 py-2 text-xs text-zinc-200 focus:border-amber-400 focus:outline-none"
              placeholder="グループ名で検索"
            />
            <button
              type="submit"
              className="rounded-full border border-zinc-700 bg-zinc-950 px-4 py-2 text-xs text-zinc-200 hover:border-zinc-500"
            >
              検索
            </button>
          </form>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        {INITIAL_FILTERS.map((filter) => {
          const active = filter.key === initialFilter;
          return (
            <button
              key={filter.key}
              type="button"
              onClick={() => {
                setHasSearched(true);
                setInitialFilter(filter.key);
                setPage(1);
              }}
              className={[
                "rounded-full border px-3 py-1.5 transition-colors",
                active
                  ? "border-amber-400 bg-amber-400/10 text-amber-200"
                  : "border-zinc-700 bg-zinc-950 text-zinc-300 hover:border-zinc-500",
              ].join(" ")}
            >
              {filter.label}
            </button>
          );
        })}
      </div>

      {!hasSearched ? (
        <p className="mt-6 text-sm text-zinc-400">
          グループ名を入力して検索、または頭文字ボタンを選んでください。
        </p>
      ) : status === "error" ? (
        <p className="mt-6 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-100">
          読み込みに失敗しました: {message}
        </p>
      ) : groups.length === 0 ? (
        <p className="mt-6 text-sm text-zinc-400">該当するグループがありません。</p>
      ) : (
        <ul className="mt-4 grid gap-2 text-sm text-zinc-200 sm:grid-cols-2">
          {groups.map((group) => (
            <li key={group.id} className="rounded-lg border border-zinc-800/60 p-3">
              {group.slug ? (
                <Link
                  className="underline decoration-zinc-500 underline-offset-2 hover:text-white"
                  href={`/nandatte/${group.slug}`}
                >
                  {group.name_ja ?? group.slug}
                </Link>
              ) : (
                <span className="text-zinc-400">{group.name_ja ?? "No slug"}</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {hasSearched && status === "loading" && (
        <p className="mt-4 text-xs text-zinc-400">検索中...</p>
      )}

      {hasSearched && (
        <div className="mt-6 flex items-center justify-between text-xs text-zinc-400">
        <span>
          {total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}-
          {Math.min(page * PAGE_SIZE, total)} / {total}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={page <= 1}
            className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-200 disabled:opacity-40"
          >
            前へ
          </button>
          <span>
            {page} / {pageCount}
          </span>
          <button
            type="button"
            onClick={() => setPage((prev) => Math.min(pageCount, prev + 1))}
            disabled={page >= pageCount}
            className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-200 disabled:opacity-40"
          >
            次へ
          </button>
        </div>
        </div>
      )}
    </div>
  );
}
