import "server-only";
import { createServerClient } from "@/lib/supabase/server";
import { IMAKITE_PLAYLIST } from "@/lib/imakite-playlist";
import { loadWeeklyFeature } from "@/lib/imakite-weekly-data";

export async function getWeeklyFeature() {
  try {
    return await loadWeeklyFeature(
      createServerClient({ requireServiceRole: true, noStore: true }),
      IMAKITE_PLAYLIST.id,
    );
  } catch (error) {
    console.error("[imakite/weekly] Failed to load committed feature", error);
    return null;
  }
}
