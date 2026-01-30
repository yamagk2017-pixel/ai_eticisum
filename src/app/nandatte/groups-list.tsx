"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type GroupRow = {
  id: string | number;
  name_ja: string | null;
  slug: string | null;
};

type SortKey = "name_asc" | "name_desc";

const PAGE_SIZE = 20;

export function GroupsList() {
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");
  const [sort, setSort] = useState<SortKey>("name_asc");
  const [page, setPage] = useState<number>(1);
  const [total, setTotal] = useState<number>(0);

  const pageCount = useMemo(() => {
    return Math.max(1, Math.ceil(total / PAGE_SIZE));
  }, [total]);

  useEffect(() => {
    if (page > pageCount) {
      setPage(pageCount);
    }
  }, [page, pageCount]);

  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);

    return () => {
      clearTimeout(handle);
    };
  }, [search]);

  useEffect(() => {
    const run = async () => {
      setStatus("loading");
      const supabase = createClient();
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .schema("imd")
        .from("groups")
        .select("id,name_ja,slug", { count: "exact" });

      if (debouncedSearch.trim()) {
        query = query.ilike("name_ja", `%${debouncedSearch.trim()}%`);
      }

      query = query.order("name_ja", { ascending: sort === "name_asc" }).range(from, to);

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
  }, [page, debouncedSearch, sort]);

  if (status === "loading") {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 text-sm text-zinc-300">
        グループ一覧を読み込み中...
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-6 text-sm text-red-100">
        読み込みに失敗しました: {message}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">グループ一覧</h2>
          <p className="mt-2 text-xs text-zinc-400">
            全{total}件 / {page}ページ目
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-300">
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
            }}
            className="w-48 rounded-full border border-zinc-700 bg-zinc-950 px-4 py-2 text-xs text-zinc-200 focus:border-amber-400 focus:outline-none"
            placeholder="グループ名で検索"
          />
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as SortKey)}
            className="rounded-full border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 focus:border-amber-400 focus:outline-none"
          >
            <option value="name_asc">名前順 (A→Z)</option>
            <option value="name_desc">名前順 (Z→A)</option>
          </select>
        </div>
      </div>

      {groups.length === 0 ? (
        <p className="mt-6 text-sm text-zinc-400">該当するグループがありません。</p>
      ) : (
        <ul className="mt-4 grid gap-2 text-sm text-zinc-200 sm:grid-cols-2">
          {groups.map((group) => (
            <li key={group.id} className="rounded-lg border border-zinc-800/60 p-3">
              {group.slug ? (
                <Link className="hover:text-white" href={`/nandatte/${group.slug}`}>
                  {group.name_ja ?? group.slug}
                </Link>
              ) : (
                <span className="text-zinc-400">{group.name_ja ?? "No slug"}</span>
              )}
            </li>
          ))}
        </ul>
      )}

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
    </div>
  );
}
