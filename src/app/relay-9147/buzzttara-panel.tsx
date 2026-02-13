"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type TagRow = {
  id: string;
  name: string;
  icon: string;
};

type GroupRow = {
  id: string;
  name_ja: string | null;
  slug: string | null;
};

type TweetListRow = {
  id: string;
  tweet_url: string;
  idol_name: string;
  group_id: string | null;
  like_count: number | null;
  view_count: number | null;
  admin_comment: string | null;
  created_at: string | null;
  tweet_tags: { tag_id: string }[];
};

type Status = "idle" | "loading" | "saving" | "error" | "success";

function formatDate(dateText: string | null): string {
  if (!dateText) return "-";
  const timestamp = Date.parse(dateText);
  if (Number.isNaN(timestamp)) return dateText;
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

export function BuzzttaraPanel() {
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string>("");
  const [tags, setTags] = useState<TagRow[]>([]);
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [tweets, setTweets] = useState<TweetListRow[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [tweetUrl, setTweetUrl] = useState("");
  const [idolName, setIdolName] = useState("");
  const [groupId, setGroupId] = useState("");
  const [adminComment, setAdminComment] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  const loadAll = async () => {
    await Promise.resolve();
    setStatus("loading");
    const supabase = createClient();
    const [tweetsRes, tagsRes, groupsRes] = await Promise.all([
      supabase
        .from("tweets")
        .select("id,tweet_url,idol_name,group_id,like_count,view_count,admin_comment,created_at,tweet_tags(tag_id)")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase.from("tags").select("id,name,icon").order("name", { ascending: true }),
      supabase.schema("imd").from("groups").select("id,name_ja,slug").order("name_ja", { ascending: true }),
    ]);

    if (tweetsRes.error || tagsRes.error || groupsRes.error) {
      setStatus("error");
      setMessage(tweetsRes.error?.message || tagsRes.error?.message || groupsRes.error?.message || "Load error");
      return;
    }

    setTweets((tweetsRes.data ?? []) as TweetListRow[]);
    setTags((tagsRes.data ?? []) as TagRow[]);
    setGroups((groupsRes.data ?? []) as GroupRow[]);
    setStatus("idle");
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadAll().catch((err: unknown) => {
        setStatus("error");
        setMessage(err instanceof Error ? err.message : "Unknown error");
      });
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const groupMap = useMemo(
    () => new Map<string, GroupRow>(groups.map((group) => [group.id, group])),
    [groups]
  );

  const resetForm = () => {
    setEditingId(null);
    setTweetUrl("");
    setIdolName("");
    setGroupId("");
    setAdminComment("");
    setSelectedTagIds([]);
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("saving");
    setMessage("");
    const supabase = createClient();

    const payload = {
      tweet_url: tweetUrl.trim(),
      idol_name: idolName.trim(),
      group_id: groupId || null,
      admin_comment: adminComment.trim() || null,
    };

    if (!payload.tweet_url || !payload.idol_name) {
      setStatus("error");
      setMessage("tweet_url と idol_name は必須です。");
      return;
    }

    let targetId = editingId;
    if (editingId) {
      const { error } = await supabase.from("tweets").update(payload).eq("id", editingId);
      if (error) {
        setStatus("error");
        setMessage(error.message);
        return;
      }
      const { error: deleteError } = await supabase.from("tweet_tags").delete().eq("tweet_id", editingId);
      if (deleteError) {
        setStatus("error");
        setMessage(deleteError.message);
        return;
      }
    } else {
      const { data, error } = await supabase.from("tweets").insert(payload).select("id").single();
      if (error) {
        setStatus("error");
        setMessage(error.message);
        return;
      }
      targetId = data?.id ?? null;
    }

    if (targetId && selectedTagIds.length > 0) {
      const rows = selectedTagIds.map((tagId) => ({ tweet_id: targetId as string, tag_id: tagId }));
      const { error: tagError } = await supabase.from("tweet_tags").insert(rows);
      if (tagError) {
        setStatus("error");
        setMessage(tagError.message);
        return;
      }
    }

    await loadAll();
    resetForm();
    setStatus("success");
    setMessage(editingId ? "ツイートを更新しました。" : "ツイートを追加しました。");
  };

  const onDelete = async (id: string) => {
    if (!window.confirm("このツイートを削除しますか？")) return;
    setStatus("saving");
    const supabase = createClient();
    const { error } = await supabase.from("tweets").delete().eq("id", id);
    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }
    await loadAll();
    if (editingId === id) resetForm();
    setStatus("success");
    setMessage("ツイートを削除しました。");
  };

  const startEdit = (tweet: TweetListRow) => {
    setEditingId(tweet.id);
    setTweetUrl(tweet.tweet_url);
    setIdolName(tweet.idol_name);
    setGroupId(tweet.group_id ?? "");
    setAdminComment(tweet.admin_comment ?? "");
    setSelectedTagIds((tweet.tweet_tags ?? []).map((item) => item.tag_id));
  };

  const toggleTag = (tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  return (
    <section className="rounded-3xl border border-white/10 bg-zinc-900/60 p-6">
      <h2 className="text-xl font-semibold text-white">BUZZTTARA 管理</h2>
      <p className="mt-1 text-sm text-zinc-300">`public.tweets` / `public.tweet_tags` を編集します。</p>

      {status === "error" && (
        <div className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-100">
          {message}
        </div>
      )}
      {status === "success" && (
        <div className="mt-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-100">
          {message}
        </div>
      )}

      <form onSubmit={onSubmit} className="mt-5 grid gap-4 rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm text-zinc-300">
            Tweet URL
            <input
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
              value={tweetUrl}
              onChange={(e) => setTweetUrl(e.target.value)}
              placeholder="https://x.com/.../status/..."
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-zinc-300">
            Idol Name
            <input
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
              value={idolName}
              onChange={(e) => setIdolName(e.target.value)}
              placeholder="表示名"
            />
          </label>
        </div>

        <label className="flex flex-col gap-2 text-sm text-zinc-300">
          Group (IMD)
          <select
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
          >
            <option value="">未選択</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name_ja ?? group.id}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-2 text-sm text-zinc-300">
          Admin Comment
          <textarea
            className="min-h-24 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
            value={adminComment}
            onChange={(e) => setAdminComment(e.target.value)}
            placeholder="任意コメント"
          />
        </label>

        <div>
          <p className="text-sm text-zinc-300">Tags</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {tags.map((tag) => (
              <label
                key={tag.id}
                className="inline-flex items-center gap-2 rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-200"
              >
                <input
                  type="checkbox"
                  checked={selectedTagIds.includes(tag.id)}
                  onChange={() => toggleTag(tag.id)}
                />
                <span>{tag.icon}</span>
                <span>{tag.name}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            className="rounded-full bg-cyan-400 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-300 disabled:opacity-60"
            disabled={status === "saving" || status === "loading"}
          >
            {editingId ? "更新する" : "追加する"}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-full border border-zinc-700 px-4 py-2 text-xs text-zinc-200 hover:border-zinc-500"
            >
              編集をキャンセル
            </button>
          )}
        </div>
      </form>

      <div className="mt-6 overflow-x-auto">
        <table className="min-w-full text-left text-sm text-zinc-200">
          <thead className="text-xs uppercase tracking-wide text-zinc-400">
            <tr>
              <th className="px-2 py-2">Idol</th>
              <th className="px-2 py-2">Group</th>
              <th className="px-2 py-2">URL</th>
              <th className="px-2 py-2">日付</th>
              <th className="px-2 py-2">操作</th>
            </tr>
          </thead>
          <tbody>
            {tweets.map((tweet) => (
              <tr key={tweet.id} className="border-t border-zinc-800">
                <td className="px-2 py-2">{tweet.idol_name}</td>
                <td className="px-2 py-2">{groupMap.get(tweet.group_id ?? "")?.name_ja ?? "-"}</td>
                <td className="max-w-[240px] truncate px-2 py-2">
                  <a href={tweet.tweet_url} target="_blank" rel="noreferrer" className="hover:text-white">
                    {tweet.tweet_url}
                  </a>
                </td>
                <td className="px-2 py-2">{formatDate(tweet.created_at)}</td>
                <td className="px-2 py-2">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(tweet)}
                      className="rounded-full border border-zinc-700 px-3 py-1 text-xs hover:border-zinc-500"
                    >
                      編集
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(tweet.id)}
                      className="rounded-full border border-red-500/60 px-3 py-1 text-xs text-red-200 hover:border-red-400"
                    >
                      削除
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
