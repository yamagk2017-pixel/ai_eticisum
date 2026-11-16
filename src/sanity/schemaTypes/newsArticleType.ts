import {defineArrayMember, defineField, defineType} from "sanity";
import {Well3StylePreview} from "@/sanity/components/well3-style-preview";
import {OrangeTextPreview} from "@/sanity/components/orange-text-preview";
import {SpeakerColorInput} from "@/sanity/components/speaker-color-input";
import {normalizeSpeakerName, SPEAKER_COLOR_PATTERN} from "@/lib/news/speaker-colors";
import {isUniqueAcrossNewsDocuments} from "@/sanity/slug-is-unique";
import {
  createCategoryReferencesField,
  createCitationSourceArticleField,
  createPressReleaseSourceField,
  createSeoFields,
  createTagReferencesField,
  relatedGroupsField,
} from "./shared";

export const newsArticleType = defineType({
  name: "newsArticle",
  title: "News Article (Sanity / New)",
  type: "document",
  fieldsets: [
    {
      name: "taxonomy",
      title: "Categories / Tags",
      options: {columns: 2},
    },
    {
      name: "advanced",
      title: "Excerpt以下（低優先）",
      options: {collapsible: true, collapsed: true},
    },
  ],
  fields: [
    createPressReleaseSourceField(),
    defineField({
      name: "title",
      title: "Title",
      type: "string",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "slug",
      title: "Slug",
      type: "slug",
      options: {source: "title", maxLength: 200, isUnique: isUniqueAcrossNewsDocuments},
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "publishedAt",
      title: "Published At",
      type: "datetime",
      options: {
        displayTimeZone: "Asia/Tokyo",
        allowTimeZoneSwitch: false,
      },
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
      name: "speakerColors",
      title: "話者名の文字色（インタビュー）",
      description: "話者名と色を1回設定すると、本文の各段落の先頭にある「話者名：」すべてに適用します。本文と同じ呼び名を入力してください（例：ミッポ）。コロンの入力は不要です。",
      type: "array",
      of: [defineArrayMember({
        name: "interviewSpeakerColor",
        title: "話者の色",
        type: "object",
        fields: [
          defineField({
            name: "speakerName", title: "話者名", type: "string",
            validation: (rule) => rule.required().custom((value) =>
              !value || normalizeSpeakerName(value).length > 0 ? true : "話者名を入力してください"
            ),
          }),
          defineField({
            name: "color", title: "文字色", type: "string", initialValue: "#f97316",
            description: "色見本・カラーピッカーから選択するか、#から始まる6桁の色コードを入力できます。",
            components: {input: SpeakerColorInput},
            validation: (rule) => rule.required().regex(SPEAKER_COLOR_PATTERN, {name: "#RRGGBB形式の色コード"}),
          }),
        ],
        preview: {
          select: {title: "speakerName", subtitle: "color"},
          prepare: ({title, subtitle}) => ({title: title ? `${normalizeSpeakerName(title)}：` : "話者名を入力", subtitle}),
        },
      })],
      validation: (rule) => rule.custom((value) => {
        const names = (value ?? []).flatMap((item) => {
          if (!item || typeof item !== "object" || !("speakerName" in item)) return [];
          return [normalizeSpeakerName(String(item.speakerName ?? ""))];
        }).filter(Boolean);
        return new Set(names).size === names.length || "同じ話者名の色は1つにまとめてください";
      }),
    }),
    defineField({
      name: "body",
      title: "Body (Portable Text)",
      type: "array",
      of: [
        defineArrayMember({
          type: "block",
          marks: {
            decorators: [
              {title: "Strong", value: "strong"},
              {title: "Emphasis", value: "em"},
              {title: "Code", value: "code"},
              {title: "Underline", value: "underline"},
              {title: "Strike", value: "strike-through"},
              {title: "オレンジ", value: "orange", component: OrangeTextPreview},
            ],
          },
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
          name: "pageBreak",
          title: "改ページ",
          fields: [
            defineField({
              name: "kind",
              title: "Kind",
              type: "string",
              initialValue: "page_break",
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
              initialValue: "small",
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
    createCategoryReferencesField({fieldset: "taxonomy"}),
    createTagReferencesField({fieldset: "taxonomy"}),
    relatedGroupsField,
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
    createCitationSourceArticleField(),
    defineField({
      name: "excerpt",
      title: "Excerpt",
      type: "text",
      fieldset: "advanced",
      rows: 3,
      description: "任意・低優先。未入力時は本文冒頭を利用。",
    }),
    ...createSeoFields({fieldset: "advanced"}),
  ],
  preview: {
    select: {
      title: "title",
      media: "heroImage",
      publishedAt: "publishedAt",
    },
    prepare({title, media, publishedAt}) {
      return {
        title,
        media,
        subtitle: publishedAt
          ? new Date(publishedAt).toLocaleString("ja-JP", {timeZone: "Asia/Tokyo"})
          : undefined,
      };
    },
  },
});
