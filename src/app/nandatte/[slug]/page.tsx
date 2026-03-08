import type { Metadata } from "next";
import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import { GroupDetail } from "./group-detail";

type PageProps = {
  params: { slug: string } | Promise<{ slug: string }>;
};

const NANDATTE_TITLE_SUFFIX =
  'のナンダッテ | DOL CROSSING - アイドルと音楽の情報交差点「アイドルクロッシング」';

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolved = await params;
  const safeSlug = resolved.slug.trim();

  if (!safeSlug) {
    return { title: `ナンダッテ ${NANDATTE_TITLE_SUFFIX}` };
  }

  try {
    const supabase = createServerClient();
    const { data } = await supabase
      .schema("imd")
      .from("groups")
      .select("name_ja")
      .ilike("slug", safeSlug)
      .maybeSingle();

    const groupName = data?.name_ja?.trim();
    return {
      title: `${groupName && groupName.length > 0 ? groupName : "ナンダッテ"} ${NANDATTE_TITLE_SUFFIX}`,
    };
  } catch {
    return { title: `ナンダッテ ${NANDATTE_TITLE_SUFFIX}` };
  }
}

export default async function GroupPage({ params }: PageProps) {
  const resolved = await params;

  return (
    <div className="min-h-screen bg-[var(--ui-page)] text-[var(--ui-text)]">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 pb-16 pt-10 sm:px-12">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            className="text-xs text-[var(--ui-text-subtle)] hover:text-[var(--ui-text)]"
            href="/nandatte"
          >
            ← ナンダッテ一覧に戻る
          </Link>
        </div>
        <GroupDetail slug={resolved.slug} />
      </main>
    </div>
  );
}
