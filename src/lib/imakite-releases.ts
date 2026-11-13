import "server-only";
import { cache } from "react";
import { createServerClient } from "@/lib/supabase/server";
import { loadRelease, loadReleaseDates } from "@/lib/imakite-releases-data";

// React cache only deduplicates within a request. All reads use no-store.
export const getRelease = cache(async (date?: string) => {
  try {
    return await loadRelease(createServerClient({ requireServiceRole: true, noStore: true }), date);
  } catch (error) {
    console.error("[imakite/releases] Read failed", error);
    throw new Error("追加曲の情報を取得できませんでした。");
  }
});
export const getReleaseDates = cache(async () => {
  try {
    return await loadReleaseDates(createServerClient({ requireServiceRole: true, noStore: true }));
  } catch (error) {
    console.error("[imakite/releases] Archive read failed", error);
    throw new Error("追加曲の履歴を取得できませんでした。");
  }
});
