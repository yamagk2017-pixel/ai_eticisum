import { fetchLatestWpPost } from "@/lib/wp/client";

export const dynamic = "force-dynamic";

function formatDate(value: string | null) {
  if (!value) return "-";
  const time = Date.parse(value);
  if (Number.isNaN(time)) return value;
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(time));
}

export default async function WpMvpPage() {
  const hasBaseUrl = Boolean(process.env.WP_API_BASE_URL?.trim());

  if (!hasBaseUrl) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <div className="rounded-2xl border border-zinc-300/80 bg-white/80 p-6 dark:border-zinc-800 dark:bg-zinc-900/60">
          <h1 className="text-2xl font-semibold">WP MVP (latest post)</h1>
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">
            `WP_API_BASE_URL` が未設定です。`.env.local` に WordPress のベースURLを追加してください。
          </p>
          <pre className="mt-4 overflow-x-auto rounded-xl bg-zinc-100 p-4 text-xs text-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
{`WP_API_BASE_URL=https://your-wordpress-site.example.com`}
          </pre>
          <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-300">
            設定後に <code>/wp-mvp</code> を再読み込みすると、最新記事1件を表示します。
          </p>
        </div>
      </main>
    );
  }

  try {
    const post = await fetchLatestWpPost();

    if (!post) {
      return (
        <main className="mx-auto max-w-3xl px-6 py-12">
          <div className="rounded-2xl border border-zinc-300/80 bg-white/80 p-6 dark:border-zinc-800 dark:bg-zinc-900/60">
            <h1 className="text-2xl font-semibold">WP MVP (latest post)</h1>
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">
              記事が取得できませんでした（0件）。
            </p>
          </div>
        </main>
      );
    }

    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <div className="mb-6 rounded-2xl border border-emerald-300/60 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-700/60 dark:bg-emerald-950/40 dark:text-emerald-200">
          SupabaseなしのMVPです。Next.jsサーバー側からWP REST APIを読んで表示しています。
        </div>

        <article className="overflow-hidden rounded-2xl border border-zinc-300/80 bg-white/90 dark:border-zinc-800 dark:bg-zinc-900/70">
          {post.featuredImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={post.featuredImageUrl}
              alt={post.featuredImageAlt ?? ""}
              className="h-auto max-h-[420px] w-full object-cover"
            />
          ) : null}

          <div className="p-6">
            <p className="text-xs tracking-wide text-zinc-500 dark:text-zinc-400">
              WP Post ID: {post.id} / {formatDate(post.date)}
            </p>

            <h1
              className="mt-2 text-2xl font-semibold leading-tight"
              dangerouslySetInnerHTML={{ __html: post.titleHtml }}
            />

            {post.url ? (
              <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                Source:{" "}
                <a
                  href={post.url}
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-2"
                >
                  {post.url}
                </a>
              </p>
            ) : null}

            {post.excerptHtml ? (
              <div
                className="mt-5 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950/60 dark:text-zinc-300"
                dangerouslySetInnerHTML={{ __html: post.excerptHtml }}
              />
            ) : null}

            <div
              className="mt-6 space-y-4 text-[15px] leading-7 text-zinc-800 dark:text-zinc-200 [&_a]:underline [&_a]:underline-offset-2 [&_img]:h-auto [&_img]:max-w-full [&_p]:my-4 [&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6"
              dangerouslySetInnerHTML={{ __html: post.contentHtml }}
            />
          </div>
        </article>
      </main>
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <div className="rounded-2xl border border-rose-300/70 bg-rose-50 p-6 dark:border-rose-800/60 dark:bg-rose-950/30">
          <h1 className="text-2xl font-semibold">WP MVP (latest post)</h1>
          <p className="mt-3 text-sm text-rose-900 dark:text-rose-200">取得に失敗しました。</p>
          <pre className="mt-4 overflow-x-auto rounded-xl bg-white/70 p-4 text-xs text-rose-950 dark:bg-zinc-950/60 dark:text-rose-200">
{message}
          </pre>
        </div>
      </main>
    );
  }
}
