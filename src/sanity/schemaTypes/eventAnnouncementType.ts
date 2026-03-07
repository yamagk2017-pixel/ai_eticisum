import {defineArrayMember, defineField, defineType} from "sanity";
import {RelatedGroupObjectInput} from "@/sanity/components/related-groups-input/related-group-object-input";
import {
  categoryReferencesField,
  citationSourceArticleField,
  relatedGroupArrayMembers,
  seoFields,
  tagReferencesField,
} from "./shared";

export const eventAnnouncementType = defineType({
  name: "eventAnnouncement",
  title: "Event Announcement (PT)",
  type: "document",
  fieldsets: [
    {
      name: "eventInfo",
      title: "イベント情報（上部表示）",
      options: {collapsible: false},
    },
  ],
  fields: [
    defineField({
      name: "title",
      title: "タイトル",
      type: "string",
      fieldset: "eventInfo",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "eventDate",
      title: "日にち",
      type: "date",
      options: {dateFormat: "YYYY-MM-DD"},
      fieldset: "eventInfo",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "eventTimeText",
      title: "時間",
      type: "string",
      fieldset: "eventInfo",
      description: "例: OPEN 18:00 / START 18:30",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "relatedGroups",
      title: "出演グループ（imd.groups）",
      description: "ライブ出演など、グループ単位で出演する場合に登録します。複数可。",
      type: "array",
      of: relatedGroupArrayMembers,
      fieldset: "eventInfo",
    }),
    defineField({
      name: "representativePerformers",
      title: "代表者出演（複数可）",
      description: "トークイベントなど、個人名で表示したい出演者を登録します。",
      type: "array",
      fieldset: "eventInfo",
      of: [
        defineArrayMember({
          type: "object",
          name: "representativePerformer",
          fields: [
            defineField({
              name: "name",
              title: "出演者名",
              type: "string",
              validation: (rule) => rule.required(),
            }),
            defineField({
              name: "group",
              title: "所属グループ（imd.groups・任意）",
              type: "object",
              components: {
                input: RelatedGroupObjectInput,
              },
              fields: [
                defineField({
                  name: "groupNameJa",
                  title: "Group Name (JA)",
                  type: "string",
                }),
                defineField({
                  name: "imdGroupId",
                  title: "imd.groups ID",
                  type: "string",
                  hidden: true,
                }),
              ],
            }),
          ],
          preview: {
            select: {
              title: "name",
              groupName: "group.groupNameJa",
            },
            prepare({title, groupName}) {
              return {
                title: title ?? "(no performer name)",
                subtitle: groupName ? `所属: ${groupName}` : "所属: 未設定",
              };
            },
          },
        }),
      ],
    }),
    defineField({
      name: "ticketSalesUrl",
      title: "チケット販売URL",
      type: "string",
      fieldset: "eventInfo",
    }),
    defineField({
      name: "isMyRelatedEvent",
      title: "私の主催/関連イベント",
      type: "boolean",
      fieldset: "eventInfo",
      initialValue: false,
      description:
        "ONにすると、トップページの「関連イベント」枠に表示対象になります（開催日を過ぎると自動で非表示）。",
    }),
    defineField({
      name: "slug",
      title: "Slug",
      type: "slug",
      options: {source: "title", maxLength: 200},
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "publishedAt",
      title: "Published At",
      type: "datetime",
      initialValue: () => new Date().toISOString(),
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "heroImage",
      title: "Hero Image",
      type: "image",
      options: {hotspot: true},
      validation: (rule) => rule.required(),
    }),
    categoryReferencesField,
    tagReferencesField,
    defineField({
      name: "body",
      title: "Body (Portable Text)",
      type: "array",
      of: [
        defineArrayMember({type: "block"}),
        defineArrayMember({
          type: "image",
          options: {hotspot: true},
        }),
      ],
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "excerpt",
      title: "Excerpt",
      type: "text",
      rows: 3,
      description: "任意。未入力時は本文冒頭を利用。",
    }),
    citationSourceArticleField,
    ...seoFields,
  ],
  preview: {
    select: {
      title: "title",
      media: "heroImage",
      eventDate: "eventDate",
      eventTimeText: "eventTimeText",
      relatedGroups: "relatedGroups",
      isMyRelatedEvent: "isMyRelatedEvent",
    },
    prepare({title, media, eventDate, eventTimeText, relatedGroups, isMyRelatedEvent}) {
      const mainPerformer =
        Array.isArray(relatedGroups) && relatedGroups[0]?.groupNameJa ? relatedGroups[0].groupNameJa : "出演者未設定";
      const dateText = eventDate ?? "日付未設定";
      const timeText = eventTimeText ?? "時間未設定";
      return {
        title,
        media,
        subtitle: `${isMyRelatedEvent ? "[関連] " : ""}${dateText} ${timeText} / ${mainPerformer}`,
      };
    },
  },
});
