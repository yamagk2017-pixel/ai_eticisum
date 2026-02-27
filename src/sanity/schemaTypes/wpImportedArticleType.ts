import {defineField, defineType} from "sanity";
import {
  categoryReferencesField,
  relatedGroupsField,
  seoFields,
  tagReferencesField,
} from "./shared";

export const wpImportedArticleType = defineType({
  name: "wpImportedArticle",
  title: "WP Imported Article (Legacy HTML)",
  type: "document",
  fields: [
    defineField({
      name: "title",
      title: "Title",
      type: "string",
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
      description: "任意。WP APIで取得不可のケースがあるため、移行時は空を許容する。",
    }),
    categoryReferencesField,
    tagReferencesField,
    relatedGroupsField,
    defineField({
      name: "legacyBodyHtml",
      title: "Legacy Body HTML",
      type: "text",
      rows: 20,
      validation: (rule) => rule.required(),
      description: "WP移行記事の本文HTML。初期はPortable Text変換を行わず保持する。",
    }),
    defineField({
      name: "wpPostId",
      title: "WP Post ID",
      type: "number",
      validation: (rule) => rule.required().integer().positive(),
    }),
    defineField({
      name: "originalWpUrl",
      title: "Original WP URL",
      type: "url",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "excerpt",
      title: "Excerpt",
      type: "text",
      rows: 3,
      description: "任意・低優先。未入力時は本文冒頭を利用。",
    }),
    defineField({
      name: "importedAt",
      title: "Imported At",
      type: "datetime",
    }),
    defineField({
      name: "migrationNotes",
      title: "Migration Notes",
      type: "text",
      rows: 4,
    }),
    defineField({
      name: "bodyMigrationStatus",
      title: "Body Migration Status",
      type: "string",
      options: {
        list: [
          {title: "Legacy HTML", value: "legacy_html"},
          {title: "Partial PT", value: "partial_pt"},
          {title: "Portable Text Done", value: "portable_text_done"},
        ],
      },
      initialValue: "legacy_html",
    }),
    ...seoFields,
  ],
  preview: {
    select: {
      title: "title",
      media: "heroImage",
      wpPostId: "wpPostId",
      publishedAt: "publishedAt",
    },
    prepare({title, media, wpPostId, publishedAt}) {
      const dateText = publishedAt ? new Date(publishedAt).toLocaleDateString("ja-JP") : "-";
      return {
        title,
        media,
        subtitle: `WP:${wpPostId ?? "-"} / ${dateText}`,
      };
    },
  },
});
