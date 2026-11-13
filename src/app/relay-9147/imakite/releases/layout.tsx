import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

// The existing /relay-9147/:path* proxy protects every page and RSC request here.
export default function ReleaseLayout({ children }: { children: React.ReactNode }) {
  return children;
}
