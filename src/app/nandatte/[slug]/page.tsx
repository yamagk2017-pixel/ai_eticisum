import Link from "next/link";
import { GroupDetail } from "./group-detail";

type PageProps = {
  params: {
    slug: string;
  };
};

export default function GroupPage({ params }: PageProps) {
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-16">
        <Link className="text-xs text-zinc-400 hover:text-white" href="/nandatte">
          ← ナンダッテ一覧に戻る
        </Link>
        <GroupDetail slug={params.slug} />
      </main>
    </div>
  );
}
