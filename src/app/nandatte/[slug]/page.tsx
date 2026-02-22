import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { GroupDetail } from "./group-detail";

type PageProps = {
  params: {
    slug: string;
  };
};

export default function GroupPage({ params }: PageProps) {
  return (
    <div className="min-h-screen bg-[var(--ui-page)] text-[var(--ui-text)]">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-8 pb-16 pt-10 sm:px-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            className="text-xs text-[var(--ui-text-subtle)] hover:text-[var(--ui-text)]"
            href="/nandatte"
          >
            ← ナンダッテ一覧に戻る
          </Link>
          <ThemeToggle />
        </div>
        <GroupDetail slug={params.slug} />
      </main>
    </div>
  );
}
