import {defineArrayMember, defineField, defineType} from "sanity";
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
      title: "イベントタイトル",
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
      title: "出演者1（imd.groups）",
      description: "imd.groups から1件選択してください。",
      type: "array",
      of: relatedGroupArrayMembers,
      fieldset: "eventInfo",
      validation: (rule) => rule.required().min(1).max(1),
    }),
    defineField({
      name: "externalPerformers",
      title: "出演者2（imd.groups登録外・複数可）",
      type: "array",
      of: [defineArrayMember({type: "string"})],
      fieldset: "eventInfo",
      options: {
        sortable: true,
      },
    }),
    defineField({
      name: "ticketSalesUrl",
      title: "チケット販売URL",
      type: "string",
      fieldset: "eventInfo",
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
    },
    prepare({title, media, eventDate, eventTimeText, relatedGroups}) {
      const mainPerformer =
        Array.isArray(relatedGroups) && relatedGroups[0]?.groupNameJa ? relatedGroups[0].groupNameJa : "出演者未設定";
      const dateText = eventDate ?? "日付未設定";
      const timeText = eventTimeText ?? "時間未設定";
      return {
        title,
        media,
        subtitle: `${dateText} ${timeText} / ${mainPerformer}`,
      };
    },
  },
});
