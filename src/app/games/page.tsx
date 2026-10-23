import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "IDOL CROSSING GAMES",
  description: "IDOL CROSSINGのゲームを選んで遊べます",
};

const games = [
  {
    href: "/games/escape",
    title: "ESCAPE!!",
    description: "迫ってくるボールをかわし、夜に現れる出口を目指す3Dアクション。",
    badge: "3D ACTION",
  },
  {
    href: "/games/jintori",
    title: "陣取りボール",
    description: "勝つ色を予想して、ロボットたちの30秒陣取りバトルを見届けよう。",
    badge: "PRIVATE DEMO",
    image: "/games/jintori/stage-bg.jpg",
  },
] as const;

export default function GamesPage() {
  return (
    <main className="min-h-screen bg-[#0d0726] px-5 py-20 text-white sm:px-8">
      <div className="mx-auto w-full max-w-5xl">
        <div className="mb-10 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/svg_logo_wh.svg" alt="IDOL CROSSING" className="mx-auto w-[190px]" />
          <p className="mt-5 text-xs font-black uppercase tracking-[0.3em] text-cyan-200">
            IDOL CROSSING GAMES
          </p>
          <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-6xl">ゲームを選ぶ</h1>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          {games.map((game) => (
            <Link
              key={game.href}
              href={game.href}
              className="group relative min-h-[300px] overflow-hidden rounded-2xl border border-white/20 bg-[#1a0f40] transition hover:-translate-y-1 hover:border-[#ffd86b]"
            >
              {"image" in game ? (
                <Image
                  src={game.image}
                  alt=""
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="object-cover opacity-40 transition duration-300 group-hover:scale-105 group-hover:opacity-55"
                />
              ) : (
                <div className="absolute inset-0 bg-[linear-gradient(145deg,#155e75_0%,#172554_55%,#4c1d95_100%)] opacity-80" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[#0d0726] via-[#0d0726]/45 to-transparent" />
              <div className="relative flex min-h-[300px] flex-col justify-end p-6 sm:p-8">
                <span className="mb-auto w-fit rounded-full border border-[#ffd86b]/60 bg-black/45 px-3 py-1 text-[10px] font-black tracking-[0.18em] text-[#ffd86b]">
                  {game.badge}
                </span>
                <h2 className="text-3xl font-black sm:text-4xl">{game.title}</h2>
                <p className="mt-3 max-w-md text-sm leading-6 text-white/75">{game.description}</p>
                <span className="mt-5 text-sm font-black text-[#ffd86b]">プレイする →</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
