import type { Metadata } from "next";

export const metadata: Metadata = {
  title:
    "毎日更新 イマキテランキング | IDOL CROSSING - アイドルと音楽の情報交差点「アイドルクロッシング」",
};

export default function ImakiteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
