import type {Metadata} from "next";
import {draftMode} from "next/headers";
import Link from "next/link";
import {notFound} from "next/navigation";
import {ArticleCitations} from "@/components/news/article-citations";
import {NandatteRelatedChart} from "@/components/news/nandatte-related-chart";
import {RelatedGroupsSidebar} from "@/components/news/related-groups-sidebar";
import {SanityGallery} from "@/components/news/sanity-gallery";
import {SanityArticleBody} from "@/components/news/sanity-article-body";
import {getNewsRelatedGroupsInfo} from "@/lib/news/related-groups";
import {buildArticleMetadata, stripHtmlForText} from "@/lib/news/seo";
import {getSanityNewsBySlug, type SanityRelatedGroup} from "@/lib/news/sanity";
import type {NewsArticle} from "@/lib/news/types";
import {hasSanityStudioEnv} from "@/sanity/env";

export const dynamic = "force-dynamic";
const NEWS_DETAIL_SITE_NAME = "IDOL CROSSING - アイドルと音楽の情報交差点「アイドルクロッシング」";

type Params = {slug: string} | Promise<{slug: string}>;

function formatDate(value: string | null) {
  if (!value) return "-";
  const time = Date.parse(value);
  if (Number.isNaN(time)) return value;
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(time));
}

function formatDateOnly(value: string | null) {
  if (!value) return "-";
  const time = Date.parse(value);
  if (Number.isNaN(time)) return value;
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(time));
}

function formatDateOnlyWithWeekday(value: string | null) {
  if (!value) return "-";
  const time = Date.parse(value);
  if (Number.isNaN(time)) return value;
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).format(new Date(time));
}

function formatEventDateRange(startDate: string | null, endDate: string | null) {
  if (startDate && endDate) return `${formatDateOnly(startDate)}〜${formatDateOnly(endDate)}`;
  if (startDate) return formatDateOnly(startDate);
  if (endDate) return formatDateOnly(endDate);
  return "-";
}

function toSafeHref(url: string | null) {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return null;
}

function relatedGroupKey(item: SanityRelatedGroup) {
  const id = typeof item.imdGroupId === "string" ? item.imdGroupId.trim() : "";
  if (id) return `id:${id}`;
  return `name:${item.groupNameJa.trim().toLowerCase()}`;
}

function toSeoArticleShape(article: Awaited<ReturnType<typeof getSanityNewsBySlug>>): NewsArticle | null {
  if (!article) return null;
  return {
    source: "sanity",
    routeType: "sanity-slug",
    path: article.path,
    id: Math.abs(Array.from(article.id).reduce((acc, c) => ((acc << 5) - acc + c.charCodeAt(0)) | 0, 0)),
    slug: article.slug,
    url: null,
    publishedAt: article.publishedAt,
    titleHtml: article.titleHtml,
    excerptHtml: article.excerpt ? article.excerpt : "",
    contentHtml: "",
    featuredImageUrl: article.featuredImageUrl,
    featuredImageAlt: null,
    categories: article.categories,
    tags: article.tags,
  };
}

export async function generateMetadata({params}: {params: Params}): Promise<Metadata> {
  const resolved = await params;
  try {
    const {isEnabled} = await draftMode();
    const article = await getSanityNewsBySlug(resolved.slug, {preview: isEnabled});
    return buildArticleMetadata(toSeoArticleShape(article), {
      fallbackTitle: "News",
      canonicalStrategy: "self",
      siteName: NEWS_DETAIL_SITE_NAME,
    });
  } catch {
    return {title: "News"};
  }
}

export default async function SanityNewsArticlePage({params}: {params: Params}) {
  const resolved = await params;
  const {isEnabled} = await draftMode();

  if (!hasSanityStudioEnv()) {
    return (
      <main className="mx-auto w-full max-w-6xl px-6 py-12 sm:px-12">
        <div className="rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-panel)] p-6">
          <p className="text-sm text-[var(--ui-text-subtle)]">
            Sanity環境変数が未設定のため、Sanity記事を表示できません。
          </p>
        </div>
      </main>
    );
  }

  const article = await getSanityNewsBySlug(resolved.slug, {preview: isEnabled});
  if (!article) notFound();
  const titleText = stripHtmlForText(article.titleHtml).toLowerCase();
  const highlightLeadBlock = titleText.includes("vol.205") && titleText.includes("lizz");
  const eventInfo = article.eventInfo;
  const isRadioAnnouncement = article.type === "radioAnnouncement";
  const ticketHref = toSafeHref(eventInfo?.ticketSalesUrl ?? null);
  const officialSiteHref = toSafeHref(eventInfo?.officialSiteUrl ?? null);
  const streamingHref = toSafeHref(eventInfo?.streamingUrl ?? null);
  const archiveHref = toSafeHref(eventInfo?.archiveUrl ?? null);
  const afterTalkHref = toSafeHref(eventInfo?.afterTalkUrl ?? null);
  const hasArchiveUrl = Boolean(eventInfo?.archiveUrl);
  const hasAfterTalkUrl = Boolean(eventInfo?.afterTalkUrl);
  const hasStreamingInfo = Boolean(
    eventInfo?.streamingUrl || eventInfo?.streamingDeadline || eventInfo?.streamingPrice
  );
  const eventPriceLabel =
    eventInfo?.eventPrice && eventInfo.eventPricePlusOneDrink ? `${eventInfo.eventPrice}（+1D）` : eventInfo?.eventPrice ?? null;

  const combinedRelatedGroups = [...article.relatedGroups];
  const existingKeys = new Set(combinedRelatedGroups.map(relatedGroupKey));
  for (const rep of eventInfo?.representativePerformers ?? []) {
    const hasGroupId = typeof rep.imdGroupId === "string" && rep.imdGroupId.trim().length > 0;
    const hasGroupName = typeof rep.groupNameJa === "string" && rep.groupNameJa.trim().length > 0;
    if (!hasGroupId && !hasGroupName) continue;
    const candidate: SanityRelatedGroup = {
      groupNameJa: rep.groupNameJa ?? "",
      imdGroupId: rep.imdGroupId ?? null,
    };
    const key = relatedGroupKey(candidate);
    if (existingKeys.has(key)) continue;
    existingKeys.add(key);
    combinedRelatedGroups.push(candidate);
  }

  const allGroupPanels = await getNewsRelatedGroupsInfo(combinedRelatedGroups);
  const sidebarSourceGroups = article.relatedGroups.length > 0 ? article.relatedGroups : combinedRelatedGroups;
  const sidebarGroupKeys = new Set(sidebarSourceGroups.map(relatedGroupKey));
  const relatedGroupPanels = allGroupPanels.filter((group) =>
    sidebarGroupKeys.has(relatedGroupKey({groupNameJa: group.groupNameJa, imdGroupId: group.imdGroupId}))
  );

  const groupById = new Map<string, {name: string; href: string | null}>();
  const groupByName = new Map<string, {name: string; href: string | null}>();
  for (const group of allGroupPanels) {
    const href = group.slug ? `/nandatte/${group.slug}` : null;
    if (group.imdGroupId) groupById.set(group.imdGroupId, {name: group.groupNameJa, href});
    groupByName.set(group.groupNameJa.trim().toLowerCase(), {name: group.groupNameJa, href});
  }

  type PerformerItem =
    | {kind: "group"; groupName: string; href: string | null}
    | {kind: "representative"; name: string; groupName: string | null; groupHref: string | null}
    | {kind: "legacy"; name: string}
    | {kind: "etc"};
  const performerItems: PerformerItem[] = [];
  const representativeNameSet = new Set<string>();
  const representativeCompositeSet = new Set<string>();
  const hasAnyGroupPerformer = article.relatedGroups.length > 0;
  for (const group of article.relatedGroups) {
    const byId = group.imdGroupId ? groupById.get(group.imdGroupId) : null;
    const byName = groupByName.get(group.groupNameJa.trim().toLowerCase());
    const linked = byId ?? byName ?? null;
    performerItems.push({
      kind: "group",
      groupName: linked?.name ?? group.groupNameJa,
      href: linked?.href ?? null,
    });
  }

  for (const rep of eventInfo?.representativePerformers ?? []) {
    const groupInfo = rep.imdGroupId
      ? groupById.get(rep.imdGroupId) ?? null
      : rep.groupNameJa
        ? groupByName.get(rep.groupNameJa.trim().toLowerCase()) ?? null
        : null;

    const groupText = groupInfo?.name ?? rep.groupNameJa ?? null;
    const repNameKey = rep.name.trim().toLowerCase();
    const repCompositeKey = `${repNameKey}|${(rep.imdGroupId ?? "").trim()}|${(groupText ?? "").trim().toLowerCase()}`;
    if (representativeCompositeSet.has(repCompositeKey)) continue;
    representativeCompositeSet.add(repCompositeKey);
    if (repNameKey) representativeNameSet.add(repNameKey);

    performerItems.push({
      kind: "representative",
      name: rep.name,
      groupName: groupText,
      groupHref: groupInfo?.href ?? null,
    });
  }

  for (const legacyName of eventInfo?.legacyExternalPerformers ?? []) {
    const legacyNameKey = legacyName.trim().toLowerCase();
    if (legacyNameKey && representativeNameSet.has(legacyNameKey)) continue;
    performerItems.push({kind: "legacy", name: legacyName});
  }

  const hasAnyRepresentativePerformer =
    (eventInfo?.representativePerformers?.length ?? 0) > 0 || (eventInfo?.legacyExternalPerformers?.length ?? 0) > 0;
  const shouldAppendEtc =
    Boolean(eventInfo?.appendEtcForRelatedGroups && hasAnyGroupPerformer) ||
    Boolean(eventInfo?.appendEtcForRepresentativePerformers && hasAnyRepresentativePerformer);
  if (shouldAppendEtc) performerItems.push({kind: "etc"});

  return (
    <main className="mx-auto w-full max-w-6xl px-6 pt-10 pb-12 sm:px-12">
      <article>
        <div className="mb-8 space-y-3">
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-xs text-[var(--ui-text-subtle)]">
            <Link href="/" className="underline underline-offset-2">Home</Link>
            <span>&gt;</span>
            <Link href="/news" className="underline underline-offset-2">News</Link>
            {article.categories[0] ? (
              <>
                <span>&gt;</span>
                {article.categories[0].slug ? (
                  <Link
                    href={`/news?category=${article.categories[0].slug}`}
                    className="underline underline-offset-2"
                  >
                    {article.categories[0].name}
                  </Link>
                ) : (
                  <span>{article.categories[0].name}</span>
                )}
              </>
            ) : null}
            <span>&gt;</span>
            <span className="max-w-full truncate text-[var(--ui-text)]">{stripHtmlForText(article.titleHtml)}</span>
          </nav>
        </div>

        <div className="md:grid md:grid-cols-[minmax(0,1fr)_40%] md:items-start md:gap-8">
          {article.featuredImageUrl ? (
            <div className="md:order-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={article.featuredImageUrl} alt="" className="h-auto w-full rounded-xl object-contain" />
            </div>
          ) : null}

          <div className={article.featuredImageUrl ? "md:order-1" : undefined}>
            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 md:mt-0">
              <p className="text-xs tracking-wide text-[var(--ui-text-subtle)]">{formatDate(article.publishedAt)}</p>
              {article.categories.map((category) => (
                category.slug ? (
                  <Link
                    key={`${article.id}-${category.name}`}
                    href={`/news?category=${category.slug}`}
                    className="text-xs underline underline-offset-2"
                  >
                    {category.name}
                  </Link>
                ) : (
                  <span key={`${article.id}-${category.name}`} className="text-xs underline underline-offset-2">
                    {category.name}
                  </span>
                )
              ))}
            </div>

            <h1
              className="mt-4 font-mincho-jp text-2xl font-semibold leading-tight sm:text-3xl"
              dangerouslySetInnerHTML={{__html: article.titleHtml}}
            />

            {article.tags.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {article.tags.map((tag) => (
                  tag.slug ? (
                    <Link
                      key={`${article.id}-${tag.name}`}
                      href={`/news?tag=${tag.slug}`}
                      className="rounded-full border border-zinc-400 px-2.5 py-1 text-xs text-[var(--ui-text)]"
                    >
                      {tag.name}
                    </Link>
                  ) : (
                    <span
                      key={`${article.id}-${tag.name}`}
                      className="rounded-full border border-zinc-400 px-2.5 py-1 text-xs text-[var(--ui-text)]"
                    >
                      {tag.name}
                    </span>
                  )
                ))}
              </div>
            ) : null}

            {eventInfo ? (
              <section className="mt-6 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-panel)] p-4">
                <h2 className="text-sm font-semibold text-[var(--ui-text)]">
                  {isRadioAnnouncement ? "番組概要" : "イベント情報"}
                </h2>
                <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-[150px_minmax(0,1fr)]">
                  {eventInfo.eventTitle ? (
                    <>
                      <dt className="font-semibold text-[var(--ui-text-subtle)]">タイトル</dt>
                      <dd className="break-words">{eventInfo.eventTitle}</dd>
                    </>
                  ) : null}

                  {!isRadioAnnouncement && eventInfo.venue ? (
                    <>
                      <dt className="font-semibold text-[var(--ui-text-subtle)]">会場</dt>
                      <dd className="break-words">{eventInfo.venue}</dd>
                    </>
                  ) : null}

                  {isRadioAnnouncement ? (
                    eventInfo.broadcastDate ? (
                      <>
                        <dt className="font-semibold text-[var(--ui-text-subtle)]">放送日</dt>
                        <dd>{formatDateOnlyWithWeekday(eventInfo.broadcastDate)}</dd>
                      </>
                    ) : null
                  ) : eventInfo.eventDate || eventInfo.eventEndDate ? (
                    <>
                      <dt className="font-semibold text-[var(--ui-text-subtle)]">日にち</dt>
                      <dd>{formatEventDateRange(eventInfo.eventDate, eventInfo.eventEndDate)}</dd>
                    </>
                  ) : null}

                  {eventInfo.eventTimeText ? (
                    <>
                      <dt className="font-semibold text-[var(--ui-text-subtle)]">時間</dt>
                      <dd>{eventInfo.eventTimeText}</dd>
                    </>
                  ) : null}

                  {isRadioAnnouncement && eventInfo.personality ? (
                    <>
                      <dt className="font-semibold text-[var(--ui-text-subtle)]">パーソナリティ</dt>
                      <dd className="break-words">{eventInfo.personality}</dd>
                    </>
                  ) : null}

                  {!isRadioAnnouncement && eventInfo.organizer ? (
                    <>
                      <dt className="font-semibold text-[var(--ui-text-subtle)]">主催者</dt>
                      <dd className="break-words">{eventInfo.organizer}</dd>
                    </>
                  ) : null}

                  {!isRadioAnnouncement && eventInfo.officialSiteUrl ? (
                    <>
                      <dt className="font-semibold text-[var(--ui-text-subtle)]">公式サイト</dt>
                      <dd className="break-all">
                        {officialSiteHref ? (
                          <a href={officialSiteHref} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                            {eventInfo.officialSiteUrl}
                          </a>
                        ) : (
                          eventInfo.officialSiteUrl
                        )}
                      </dd>
                    </>
                  ) : null}

                  {isRadioAnnouncement ? (
                    performerItems.length > 0 ? (
                      <>
                        <dt className="font-semibold text-[var(--ui-text-subtle)]">出演</dt>
                        <dd className="break-words">
                          {performerItems.map((item, index) => (
                            <span key={`${item.kind}-${index}`}>
                              {index > 0 && item.kind !== "etc" ? " / " : null}
                              {item.kind === "group" ? (
                                item.href ? (
                                  <Link href={item.href} className="underline underline-offset-2">
                                    {item.groupName}
                                  </Link>
                                ) : (
                                  item.groupName
                                )
                              ) : item.kind === "representative" ? (
                                <>
                                  {item.name}
                                  {item.groupName ? (
                                    <>
                                      （
                                      {item.groupHref ? (
                                        <Link href={item.groupHref} className="underline underline-offset-2">
                                          {item.groupName}
                                        </Link>
                                      ) : (
                                        item.groupName
                                      )}
                                      ）
                                    </>
                                  ) : null}
                                </>
                              ) : item.kind === "etc" ? (
                                "他…"
                              ) : (
                                item.name
                              )}
                            </span>
                          ))}
                        </dd>
                      </>
                    ) : null
                  ) : (
                    performerItems.length > 0 ? (
                      <>
                      <dt className="font-semibold text-[var(--ui-text-subtle)]">出演</dt>
                      <dd className="break-words">
                        {performerItems.map((item, index) => (
                          <span key={`${item.kind}-${index}`}>
                            {index > 0 && item.kind !== "etc" ? " / " : null}
                            {item.kind === "group" ? (
                              item.href ? (
                                <Link href={item.href} className="underline underline-offset-2">
                                  {item.groupName}
                                </Link>
                              ) : (
                                item.groupName
                              )
                            ) : item.kind === "representative" ? (
                              <>
                                {item.name}
                                {item.groupName ? (
                                  <>
                                    （
                                    {item.groupHref ? (
                                      <Link href={item.groupHref} className="underline underline-offset-2">
                                        {item.groupName}
                                      </Link>
                                    ) : (
                                      item.groupName
                                    )}
                                    ）
                                  </>
                                ) : null}
                              </>
                            ) : item.kind === "etc" ? (
                              "他…"
                            ) : (
                              item.name
                            )}
                          </span>
                        ))}
                      </dd>
                      </>
                    ) : null
                  )}

                  {isRadioAnnouncement ? (
                    <>
                      {hasArchiveUrl ? (
                        <>
                          <dt className="font-semibold text-[var(--ui-text-subtle)]">アーカイブURL</dt>
                          <dd className="break-all">
                            {archiveHref ? (
                              <a href={archiveHref} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                                {eventInfo.archiveUrl}
                              </a>
                            ) : (
                              eventInfo.archiveUrl
                            )}
                          </dd>
                        </>
                      ) : null}

                      {hasAfterTalkUrl ? (
                        <>
                          <dt className="font-semibold text-[var(--ui-text-subtle)]">アフタートークURL</dt>
                          <dd className="break-all">
                            {afterTalkHref ? (
                              <a href={afterTalkHref} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                                {eventInfo.afterTalkUrl}
                              </a>
                            ) : (
                              eventInfo.afterTalkUrl
                            )}
                          </dd>
                        </>
                      ) : null}
                    </>
                  ) : null}

                  {!isRadioAnnouncement && eventInfo.eventPrice ? (
                    <>
                      <dt className="font-semibold text-[var(--ui-text-subtle)]">料金</dt>
                      <dd className="break-words">{eventPriceLabel}</dd>
                    </>
                  ) : null}

                  {!isRadioAnnouncement && eventInfo.ticketSalesUrl ? (
                    <>
                      <dt className="font-semibold text-[var(--ui-text-subtle)]">チケット販売URL</dt>
                      <dd className="break-all">
                        {ticketHref ? (
                          <a href={ticketHref} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                            {eventInfo.ticketSalesUrl}
                          </a>
                        ) : (
                          eventInfo.ticketSalesUrl
                        )}
                      </dd>
                    </>
                  ) : null}
                </dl>

                {!isRadioAnnouncement && hasStreamingInfo ? (
                  <>
                    <h2 className="mt-5 text-sm font-semibold text-[var(--ui-text)]">配信情報</h2>
                    <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-[150px_minmax(0,1fr)]">
                      {eventInfo.streamingUrl ? (
                        <>
                          <dt className="font-semibold text-[var(--ui-text-subtle)]">配信URL</dt>
                          <dd className="break-all">
                            {streamingHref ? (
                              <a href={streamingHref} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                                {eventInfo.streamingUrl}
                              </a>
                            ) : (
                              eventInfo.streamingUrl
                            )}
                          </dd>
                        </>
                      ) : null}

                      {eventInfo.streamingDeadline ? (
                        <>
                          <dt className="font-semibold text-[var(--ui-text-subtle)]">視聴期限</dt>
                          <dd>{`〜${formatDateOnly(eventInfo.streamingDeadline)}`}</dd>
                        </>
                      ) : null}

                      {eventInfo.streamingPrice ? (
                        <>
                          <dt className="font-semibold text-[var(--ui-text-subtle)]">配信料金</dt>
                          <dd className="break-words">{eventInfo.streamingPrice}</dd>
                        </>
                      ) : null}
                    </dl>
                  </>
                ) : null}
              </section>
            ) : null}
          </div>
        </div>

        <div className={`pt-6 ${relatedGroupPanels.length > 0 ? "lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-8" : ""}`}>
          <div>
            <SanityArticleBody value={article.body} className={highlightLeadBlock ? "news-intro-cream" : undefined} />
            {article.galleryImages.length > 0 ? <SanityGallery images={article.galleryImages} /> : null}
            <ArticleCitations
              citationSourceArticle={article.citationSourceArticle}
              citedByArticles={article.citedByArticles}
            />
            {relatedGroupPanels.length > 0 ? (
              <div className="mt-10 pt-10">
                <NandatteRelatedChart groups={relatedGroupPanels} />
              </div>
            ) : null}
          </div>
          {relatedGroupPanels.length > 0 ? <RelatedGroupsSidebar groups={relatedGroupPanels} /> : null}
        </div>
      </article>
    </main>
  );
}
