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
        defineArrayMember({type: "block"}),
        defineArrayMember({
          type: "image",
          options: {hotspot: true},
        }),
      ],
      validation: (rule) => rule.required(),
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
