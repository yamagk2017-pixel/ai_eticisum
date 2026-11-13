import type { Metadata } from "next";
import { connection } from "next/server";
import { ReleasePage } from "./release-page";

export const metadata: Metadata = {
  title: "今週の追加曲・選曲根拠 | イマキテアイドル：ジャパン | IDOL CROSSING",
  description: "イマキテアイドル：ジャパンの最新追加曲、点数内訳、選曲根拠、動画、入れ替え内容を紹介。日付別の履歴も閲覧できます。",
};
export default async function Page() {
  await connection();
  return <ReleasePage />;
}
