import {defineArrayMember, defineField, defineType} from "sanity";
import {
  citationSourceArticleField,
  categoryReferencesField,
  relatedGroupsField,
  seoFields,
  tagReferencesField,
} from "./shared";

export const newsArticleType = defineType({
  name: "newsArticle",
  title: "News Article (Sanity / New)",
  type: "document",
  fields: [
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
      options: {source: "title", maxLength: 200},
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "publishedAt",
      title: "Published At",
      type: "datetime",
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
    relatedGroupsField,
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
            {title: "囲み罫線", value: "well3"},
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
    citationSourceArticleField,
    defineField({
      name: "excerpt",
      title: "Excerpt",
      type: "text",
      rows: 3,
      description: "任意・低優先。未入力時は本文冒頭を利用。",
    }),
    ...seoFields,
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
        subtitle: publishedAt ? new Date(publishedAt).toLocaleString("ja-JP") : undefined,
      };
    },
  },
});
