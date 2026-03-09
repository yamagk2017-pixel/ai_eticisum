import {defineArrayMember, defineField, defineType} from "sanity";
import {RelatedGroupObjectInput} from "@/sanity/components/related-groups-input/related-group-object-input";
import {Well3StylePreview} from "@/sanity/components/well3-style-preview";
import {
  citationSourceArticleField,
  relatedGroupArrayMembers,
  seoFields,
  tagReferencesField,
} from "./shared";

export const radioAnnouncementType = defineType({
  name: "radioAnnouncement",
  title: "Radio Announcement (PT)",
  type: "document",
  fieldsets: [
    {
      name: "programInfo",
      title: "番組概要",
      options: {collapsible: false},
    },
  ],
  fields: [
    defineField({
      name: "title",
      title: "タイトル",
      type: "string",
      fieldset: "programInfo",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "broadcastDate",
      title: "放送日",
      type: "date",
      options: {dateFormat: "YYYY-MM-DD"},
      fieldset: "programInfo",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "eventTimeText",
      title: "時間",
      type: "string",
      fieldset: "programInfo",
      description: "例: 20:00 - 20:30",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "personality",
      title: "パーソナリティ",
      type: "string",
      fieldset: "programInfo",
    }),
    defineField({
      name: "relatedGroups",
      title: "出演グループ（imd.groups）",
      description: "ライブ出演など、グループ単位で出演する場合に登録します。複数可。",
      type: "array",
      of: relatedGroupArrayMembers,
      fieldset: "programInfo",
    }),
    defineField({
      name: "representativePerformers",
      title: "代表者出演（複数可）",
      description: "トークイベントなど、個人名で表示したい出演者を登録します。",
      type: "array",
      fieldset: "programInfo",
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
      name: "archiveUrl",
      title: "アーカイブ",
      type: "url",
      fieldset: "programInfo",
    }),
    defineField({
      name: "afterTalkUrl",
      title: "アフタートークURL（テキスト）",
      type: "url",
      fieldset: "programInfo",
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
    defineField({
      name: "categories",
      title: "Categories",
      type: "array",
      of: [
        defineArrayMember({
          type: "reference",
          to: [{type: "newsCategory"}],
        }),
      ],
      initialValue: async (_params, context) => {
        try {
          const client = context.getClient({apiVersion: "2024-01-01"});
          const category = await client.fetch<{_id: string} | null>(
            `*[_type == "newsCategory" && (title == "アイドル第四会議室" || slug.current == "i4c")][0]{_id}`
          );
          if (!category?._id) return [];
          return [{_type: "reference", _ref: category._id}];
        } catch {
          return [];
        }
      },
    }),
    tagReferencesField,
    defineField({
      name: "body",
      title: "Body (Portable Text)",
      type: "array",
      of: [
        defineArrayMember({
          type: "block",
          styles: [
            {title: "Normal", value: "normal"},
            {title: "H2", value: "h2"},
            {title: "H3", value: "h3"},
            {title: "Quote", value: "blockquote"},
            {title: "囲み罫線", value: "well3", component: Well3StylePreview},
          ],
        }),
        defineArrayMember({
          type: "object",
          name: "horizontalRule",
          title: "区切り線",
          fields: [
            defineField({
              name: "kind",
              title: "Kind",
              type: "string",
              initialValue: "hr",
              readOnly: true,
              hidden: true,
            }),
          ],
        }),
        defineArrayMember({
          type: "object",
          name: "calloutBox",
          title: "囲み罫線ボックス",
          fields: [
            defineField({
              name: "text",
              title: "Text",
              type: "text",
              rows: 4,
              validation: (rule) => rule.required(),
            }),
          ],
          preview: {
            select: {
              text: "text",
            },
            prepare({text}) {
              const raw = typeof text === "string" ? text.trim() : "";
              return {
                title: "囲み罫線ボックス",
                subtitle: raw.length > 0 ? raw : "(empty)",
              };
            },
          },
        }),
        defineArrayMember({
          type: "image",
          options: {hotspot: true},
          fields: [
            defineField({
              name: "alt",
              title: "Alt Text",
              type: "string",
            }),
            defineField({
              name: "caption",
              title: "Caption",
              type: "string",
            }),
            defineField({
              name: "displaySize",
              title: "表示サイズ",
              type: "string",
              options: {
                list: [
                  {title: "極小", value: "xsmall"},
                  {title: "小", value: "small"},
                  {title: "中", value: "medium"},
                  {title: "大", value: "large"},
                  {title: "幅いっぱい", value: "full"},
                ],
                layout: "radio",
              },
              initialValue: "medium",
            }),
            defineField({
              name: "linkUrl",
              title: "リンクURL",
              type: "url",
            }),
            defineField({
              name: "linkTarget",
              title: "リンクの開き方",
              type: "string",
              options: {
                list: [
                  {title: "同一タブ", value: "_self"},
                  {title: "新しいタブ", value: "_blank"},
                ],
                layout: "radio",
              },
              initialValue: "_self",
            }),
            defineField({
              name: "align",
              title: "Alignment",
              type: "string",
              options: {
                list: [
                  {title: "Center", value: "center"},
                  {title: "Left", value: "left"},
                  {title: "Right", value: "right"},
                ],
                layout: "radio",
              },
              initialValue: "center",
            }),
            defineField({
              name: "wrap",
              title: "Wrap",
              type: "string",
              options: {
                list: [
                  {title: "なし", value: "none"},
                  {title: "左回り込み", value: "left"},
                  {title: "右回り込み", value: "right"},
                ],
                layout: "radio",
              },
              initialValue: "none",
            }),
          ],
        }),
      ],
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "galleryImages",
      title: "Gallery Images",
      type: "array",
      options: {
        layout: "grid",
      },
      of: [
        defineArrayMember({
          type: "image",
          options: {hotspot: true},
          fields: [
            defineField({
              name: "alt",
              title: "Alt Text",
              type: "string",
            }),
            defineField({
              name: "caption",
              title: "Caption",
              type: "string",
            }),
          ],
        }),
      ],
      description: "本文とは別に表示するギャラリー画像。複数画像をまとめてドラッグ＆ドロップ可能。",
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
      broadcastDate: "broadcastDate",
      eventTimeText: "eventTimeText",
      relatedGroups: "relatedGroups",
    },
    prepare({title, media, broadcastDate, eventTimeText, relatedGroups}) {
      const mainPerformer =
        Array.isArray(relatedGroups) && relatedGroups[0]?.groupNameJa ? relatedGroups[0].groupNameJa : "出演者未設定";
      const dateText = broadcastDate ?? "放送日未設定";
      const timeText = eventTimeText ?? "時間未設定";
      return {
        title,
        media,
        subtitle: `${dateText} ${timeText} / ${mainPerformer}`,
      };
    },
  },
});
