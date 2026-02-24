import { fetchLatestWpPost, fetchWpPostById, fetchWpPostBySlug } from "@/lib/wp/client";

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

function TermPills({
  label,
  items,
  variant = "default",
}: {
  label?: string;
  items: Array<{ id: number; name: string; slug: string | null }>;
  variant?: "default" | "plain";
}) {
  if (items.length === 0) return null;

  return (
    <div className={label ? "mt-3" : ""}>
      {label ? (
        <p className="text-xs font-medium tracking-wide text-[var(--ui-text-subtle)]">{label}</p>
      ) : null}
      <div className={`${label ? "mt-2" : ""} flex flex-wrap gap-2`}>
        {items.map((item) => (
          <span
            key={`${label ?? "term"}-${item.id}`}
            className={
              variant === "plain"
                ? "text-xs text-[var(--ui-text)]"
                : "rounded-full border border-[var(--ui-border)] bg-[var(--ui-panel-soft)] px-2.5 py-1 text-xs text-[var(--ui-text)]"
            }
            title={item.slug ?? undefined}
          >
            {item.name}
          </span>
        ))}
      </div>
    </div>
  );
}

type SearchParams =
  | Record<string, string | string[] | undefined>
  | Promise<Record<string, string | string[] | undefined>>;

function firstParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return typeof value === "string" && value.trim() ? value : null;
}

export default async function WpMvpPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const hasBaseUrl = Boolean(process.env.WP_API_BASE_URL?.trim());
  const resolvedSearchParams = (await searchParams) ?? {};
  const rawId = firstParam(resolvedSearchParams.id);
  const rawSlug = firstParam(resolvedSearchParams.slug);

  if (!hasBaseUrl) {
    return (
      <main className="mx-auto w-full max-w-6xl px-6 py-12 sm:px-12">
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
    let post = null;

    if (rawId && /^\d+$/.test(rawId)) {
      post = await fetchWpPostById(Number(rawId));
    } else if (rawSlug) {
      post = await fetchWpPostBySlug(rawSlug);
    } else {
      post = await fetchLatestWpPost();
    }

    if (!post) {
      return (
        <main className="mx-auto w-full max-w-6xl px-6 py-12 sm:px-12">
          <div className="rounded-2xl border border-zinc-300/80 bg-white/80 p-6 dark:border-zinc-800 dark:bg-zinc-900/60">
            <h1 className="text-2xl font-semibold">WP MVP (latest post)</h1>
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">
              記事が取得できませんでした（0件）。
            </p>
            {(rawId || rawSlug) && (
              <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                指定値: {rawId ? `id=${rawId}` : `slug=${rawSlug}`}
              </p>
            )}
          </div>
        </main>
      );
    }

    return (
      <main className="mx-auto w-full max-w-6xl px-6 py-12 sm:px-12">
        <article>
          <div className="md:grid md:grid-cols-[minmax(0,1fr)_40%] md:items-start md:gap-8">
            {post.featuredImageUrl ? (
              <div className="md:order-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={post.featuredImageUrl}
                  alt={post.featuredImageAlt ?? ""}
                  className="h-auto w-full rounded-xl object-contain"
                />
              </div>
            ) : null}

            <div className={post.featuredImageUrl ? "md:order-1" : undefined}>
              <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 md:mt-0">
                <p className="text-xs tracking-wide text-[var(--ui-text-subtle)]">{formatDate(post.date)}</p>
                <div className="mt-0">
                  <TermPills items={post.categories} variant="plain" />
                </div>
              </div>

              <h1
                className="mt-4 font-mincho-jp text-2xl font-semibold leading-tight sm:text-3xl"
                dangerouslySetInnerHTML={{ __html: post.titleHtml }}
              />

              <div className="mt-4">
                <TermPills items={post.tags} />
              </div>
            </div>
          </div>

          <div className="pt-6">
            <div
              className="mt-6 space-y-4 text-[17px] leading-8 text-[var(--ui-text)] [overflow-wrap:anywhere] [&_.well3]:my-6 [&_.well3]:rounded-xl [&_.well3]:border [&_.well3]:border-[var(--ui-border)] [&_.well3]:bg-[var(--ui-panel-soft)] [&_.well3]:px-4 [&_.well3]:py-3 [&_.well3]:text-[17px] [&_.well3]:leading-8 [&_.well3]:text-[var(--ui-text)] [&_.well3_p]:my-0 [&_.well3_p]:px-0 [&_.well3_*]:text-inherit [&_a]:underline [&_a]:underline-offset-2 [&_a]:break-all [&_a]:whitespace-normal [&_h2]:mt-12 [&_h2]:mb-4 [&_h2]:border-b [&_h2]:border-zinc-400 dark:[&_h2]:border-zinc-500 [&_h2]:pb-3 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:leading-tight [&_h2]:[font-family:var(--font-shippori-mincho),serif] sm:[&_h2]:text-2xl [&_h3]:mt-8 [&_h3]:mb-1 [&_h3]:inline-block [&_h3]:border-b [&_h3]:border-zinc-400 dark:[&_h3]:border-zinc-500 [&_h3]:pb-0 [&_h3]:text-[1rem] [&_h3]:font-bold [&_h3]:leading-snug [&_h3]:text-zinc-700 dark:[&_h3]:text-zinc-300 sm:[&_h3]:text-[1.15rem] [&_img]:h-auto [&_img]:max-w-full [&_p]:my-4 [&_p]:px-2 sm:[&_p]:px-3 [&_p]:leading-[2.1] [&_p]:text-zinc-700 dark:[&_p]:text-zinc-200 [&_li]:text-[var(--ui-text)] [&_span]:text-inherit [&_strong]:text-inherit [&_em]:text-inherit [&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6"
              dangerouslySetInnerHTML={{ __html: post.contentHtml }}
            />
          </div>
        </article>
      </main>
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    return (
      <main className="mx-auto w-full max-w-6xl px-6 py-12 sm:px-12">
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
