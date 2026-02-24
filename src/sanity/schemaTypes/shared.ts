import {defineArrayMember, defineField} from "sanity";

export const categoryReferencesField = defineField({
  name: "categories",
  title: "Categories",
  type: "array",
  of: [
    defineArrayMember({
      type: "reference",
      to: [{type: "newsCategory"}],
    }),
  ],
});

export const tagReferencesField = defineField({
  name: "tags",
  title: "Tags",
  type: "array",
  of: [
    defineArrayMember({
      type: "reference",
      to: [{type: "newsTag"}],
    }),
  ],
});

export const relatedGroupsField = defineField({
  name: "relatedGroups",
  title: "Related Groups (imd.groups)",
  description:
    "基本は1記事=1グループ。複数登録は例外対応。将来は imd.groups.name_ja を検索候補に出す custom input を導入予定。",
  type: "array",
  of: [
    defineArrayMember({
      type: "object",
      name: "relatedGroup",
      fields: [
        defineField({
          name: "groupNameJa",
          title: "Group Name (JA)",
          type: "string",
          description: "入力は日本語グループ名ベース。将来はAutocompleteに置き換え予定。",
          validation: (rule) => rule.required(),
        }),
        defineField({
          name: "imdGroupId",
          title: "imd.groups ID",
          type: "number",
          description: "内部保存用キー。表示は groupNameJa を使用。",
          validation: (rule) => rule.required().integer().positive(),
        }),
        defineField({
          name: "displayOrder",
          title: "Display Order",
          type: "number",
          description: "複数グループ登録時の表示順（任意）",
          validation: (rule) => rule.integer().positive(),
        }),
      ],
      preview: {
        select: {
          title: "groupNameJa",
          subtitle: "imdGroupId",
        },
        prepare({title, subtitle}) {
          return {
            title: title ?? "(no group name)",
            subtitle: subtitle ? `imdGroupId: ${subtitle}` : "imdGroupId: -",
          };
        },
      },
    }),
  ],
});

export const seoFields = [
  defineField({
    name: "seoTitle",
    title: "SEO Title",
    type: "string",
    description: "未入力時は title を使用",
  }),
  defineField({
    name: "seoDescription",
    title: "SEO Description",
    type: "text",
    rows: 3,
    description: "任意。未入力時は本文冒頭を利用",
  }),
  defineField({
    name: "ogImage",
    title: "OG Image",
    type: "image",
    options: {hotspot: true},
    description: "未入力時は heroImage を使用",
  }),
];
