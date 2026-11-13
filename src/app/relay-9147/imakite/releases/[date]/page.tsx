import type { Metadata } from "next";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { isReleaseDate } from "@/lib/imakite-releases-data";
import { ReleasePage } from "../release-page";

type Props = { params: Promise<{ date: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { date } = await params;
  if (!isReleaseDate(date)) return { title: "追加曲が見つかりません | IDOL CROSSING" };
  return { title: `${date}分の追加曲・選曲根拠 | イマキテアイドル：ジャパン | IDOL CROSSING` };
}
export default async function Page({ params }: Props) {
  await connection();
  const { date } = await params;
  if (!isReleaseDate(date)) notFound();
  return <ReleasePage date={date} />;
}
