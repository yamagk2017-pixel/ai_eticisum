import {hasSanityStudioEnv} from "@/sanity/env";
import {StudioClient} from "./studio-client";

export const dynamic = "force-static";

export const metadata = {
  title: "[Studio] musicite AI Studio",
  robots: {
    index: false,
    follow: false,
  },
};

export default function StudioPage() {
  if (!hasSanityStudioEnv()) {
    return (
      <main className="mx-auto w-full max-w-3xl px-6 py-12">
        <div className="rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-panel)] p-6">
          <h1 className="font-mincho-jp text-2xl font-semibold text-[var(--ui-text)]">
            Sanity Studio Setup Required
          </h1>
          <p className="mt-4 text-sm text-[var(--ui-text-subtle)]">
            `NEXT_PUBLIC_SANITY_PROJECT_ID` と `NEXT_PUBLIC_SANITY_DATASET` が未設定です。
          </p>
          <pre className="mt-4 overflow-x-auto rounded-lg bg-[var(--ui-panel-soft)] p-4 text-xs text-[var(--ui-text)]">
{`NEXT_PUBLIC_SANITY_PROJECT_ID=your_project_id
NEXT_PUBLIC_SANITY_DATASET=production
NEXT_PUBLIC_SANITY_API_VERSION=2026-02-24`}
          </pre>
        </div>
      </main>
    );
  }

  return <StudioClient />;
}
