import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title:
    "ナンダッテ リアルアイドルディクショナリー | IDOL CROSSING - アイドルと音楽の情報交差点「アイドルクロッシング」",
};

export default function NandatteLayout({ children }: { children: ReactNode }) {
  return children;
}

