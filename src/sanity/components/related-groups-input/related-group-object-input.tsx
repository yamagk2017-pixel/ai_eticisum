"use client";

import {useEffect, useMemo, useRef, useState} from "react";
import type {ObjectInputProps} from "sanity";
import {set, setIfMissing, unset} from "sanity";

type RelatedGroupValue = {
  _type?: string;
  groupNameJa?: string;
  imdGroupId?: string;
  displayOrder?: number;
};

type Suggestion = {
  imdGroupId: string;
  groupNameJa: string;
  slug?: string | null;
};

async function fetchSuggestions(query: string, signal?: AbortSignal): Promise<Suggestion[]> {
  const res = await fetch(`/api/sanity/imd-groups-search?q=${encodeURIComponent(query)}&limit=8`, {
    method: "GET",
    signal,
  });

  if (!res.ok) throw new Error(`search failed: ${res.status}`);
  const json = (await res.json()) as {items?: Suggestion[]};
  return Array.isArray(json.items) ? json.items : [];
}

export function RelatedGroupObjectInput(props: ObjectInputProps<RelatedGroupValue>) {
  const value = (props.value ?? {}) as RelatedGroupValue;
  const [query, setQuery] = useState(value.groupNameJa ?? "");
  const [items, setItems] = useState<Suggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setQuery(value.groupNameJa ?? "");
  }, [value.groupNameJa]);

  useEffect(() => {
    const q = query.trim();
    setSearchError(null);

    if (q.length < 1) {
      setItems([]);
      setIsLoading(false);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setIsLoading(true);

    const timer = setTimeout(() => {
      fetchSuggestions(q, controller.signal)
        .then((rows) => {
          setItems(rows);
          setIsLoading(false);
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          setIsLoading(false);
          setSearchError(error instanceof Error ? error.message : "検索に失敗しました");
        });
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const selectedInfo = useMemo(() => {
    if (!value.groupNameJa) return null;
    return {
      groupNameJa: value.groupNameJa,
      imdGroupId: value.imdGroupId,
      displayOrder: value.displayOrder,
    };
  }, [value.displayOrder, value.groupNameJa, value.imdGroupId]);

  const patchBase = () =>
    setIfMissing({
      _type: "relatedGroup",
    });

  const handleQueryChange = (next: string) => {
    setQuery(next);
    setShowSuggestions(true);
    props.onChange([
      patchBase(),
      next ? set(next, ["groupNameJa"]) : unset(["groupNameJa"]),
      // Clear stale id when text is manually edited away from a selected candidate.
      unset(["imdGroupId"]),
    ]);
  };

  const handleSelect = (item: Suggestion) => {
    setQuery(item.groupNameJa);
    setShowSuggestions(false);
    props.onChange([
      patchBase(),
      set(item.groupNameJa, ["groupNameJa"]),
      set(item.imdGroupId, ["imdGroupId"]),
    ]);
  };

  const handleDisplayOrderChange = (next: string) => {
    const trimmed = next.trim();
    if (!trimmed) {
      props.onChange(unset(["displayOrder"]));
      return;
    }

    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) return;
    props.onChange([patchBase(), set(Math.trunc(parsed), ["displayOrder"])]);
  };

  return (
    <div className="space-y-4 rounded-lg border border-[var(--card-border-color)] p-3">
      <div>
        <label className="mb-1 block text-sm font-medium">Group Name (JA)</label>
        <input
          type="text"
          value={query}
          onFocus={() => setShowSuggestions(true)}
          onChange={(e) => handleQueryChange(e.currentTarget.value)}
          placeholder="グループ名で検索"
          disabled={props.readOnly}
          className="w-full rounded-md border border-[var(--card-border-color)] bg-transparent px-3 py-2 text-sm"
        />
        <p className="mt-1 text-xs opacity-70">
          日本語グループ名で検索して候補を選択すると、imd.groups ID を内部保存します。
        </p>
      </div>

      {showSuggestions && (query.trim() || isLoading || searchError || items.length > 0) ? (
        <div className="rounded-md border border-[var(--card-border-color)]">
          {isLoading ? (
            <div className="px-3 py-2 text-xs opacity-70">検索中...</div>
          ) : searchError ? (
            <div className="px-3 py-2 text-xs text-red-500">{searchError}</div>
          ) : items.length === 0 ? (
            <div className="px-3 py-2 text-xs opacity-70">候補なし</div>
          ) : (
            <ul className="max-h-56 overflow-auto py-1">
              {items.map((item) => (
                <li key={item.imdGroupId}>
                  <button
                    type="button"
                    onClick={() => handleSelect(item)}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-black/5"
                  >
                    <span>{item.groupNameJa}</span>
                    <span className="ml-3 text-xs opacity-60">{item.imdGroupId}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      <div>
        <label className="mb-1 block text-sm font-medium">Display Order</label>
        <input
          type="number"
          inputMode="numeric"
          defaultValue={value.displayOrder ?? ""}
          onChange={(e) => handleDisplayOrderChange(e.currentTarget.value)}
          placeholder="任意"
          disabled={props.readOnly}
          className="w-full rounded-md border border-[var(--card-border-color)] bg-transparent px-3 py-2 text-sm"
        />
      </div>

      {selectedInfo ? (
        <div className="rounded-md border border-[var(--card-border-color)] px-3 py-2 text-xs">
          <div>選択中: {selectedInfo.groupNameJa}</div>
          <div className="opacity-70">imdGroupId: {selectedInfo.imdGroupId ?? "(pending)"}</div>
        </div>
      ) : null}
    </div>
  );
}
