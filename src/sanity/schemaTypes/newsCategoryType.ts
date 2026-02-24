import {defineField, defineType} from "sanity";

export const newsCategoryType = defineType({
  name: "newsCategory",
  title: "News Category",
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
      options: {source: "title", maxLength: 96},
    }),
  ],
  preview: {
    select: {
      title: "title",
      subtitle: "slug.current",
    },
    prepare({title, subtitle}) {
      return {title, subtitle: subtitle ? `/${subtitle}` : undefined};
    },
  },
});
