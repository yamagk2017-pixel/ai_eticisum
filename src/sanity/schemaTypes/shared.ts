import {defineArrayMember, defineField} from "sanity";
import {RelatedGroupObjectInput} from "@/sanity/components/related-groups-input/related-group-object-input";

type OptionalFieldset = {fieldset?: string};

export function createCategoryReferencesField(options: OptionalFieldset = {}) {
  return defineField({
    name: "categories",
    title: "Categories",
    type: "array",
    fieldset: options.fieldset,
    of: [
      defineArrayMember({
        type: "reference",
        to: [{type: "newsCategory"}],
      }),
    ],
  });
}

export function createTagReferencesField(options: OptionalFieldset = {}) {
  return defineField({
    name: "tags",
    title: "Tags",
    type: "array",
    fieldset: options.fieldset,
    of: [
      defineArrayMember({
        type: "reference",
        to: [{type: "newsTag"}],
      }),
    ],
  });
}

export const categoryReferencesField = createCategoryReferencesField();
export const tagReferencesField = createTagReferencesField();

export const relatedGroupArrayMembers = [
  defineArrayMember({
    type: "object",
    name: "relatedGroup",
    components: {
      input: RelatedGroupObjectInput,
    },
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
        type: "string",
        description:
          "暫定: custom input 実装まで非表示運用。将来は候補選択時に自動保存される内部キー。",
        validation: (rule) => rule.custom((value) => {
          if (!value) return true;
          if (typeof value !== "string") return "imd.groups ID must be a string (uuid)";
          return true;
        }),
        hidden: true,
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
          subtitle: subtitle ? `imdGroupId: ${subtitle}` : "imdGroupId: (pending)",
        };
      },
    },
  }),
];

export const relatedGroupsField = defineField({
  name: "relatedGroups",
  title: "Related Groups (imd.groups)",
  description:
    "基本は1記事=1グループ。複数登録は例外対応。将来は imd.groups.name_ja を検索候補に出す custom input を導入予定。",
  type: "array",
  of: relatedGroupArrayMembers,
});

export function createCitationSourceArticleField(options: OptionalFieldset = {}) {
  return defineField({
    name: "citationSourceArticle",
    title: "Citation Source Article",
    type: "reference",
    fieldset: options.fieldset,
    to: [
      {type: "newsArticle"},
      {type: "eventAnnouncement"},
      {type: "radioAnnouncement"},
      {type: "wpImportedArticle"},
    ],
    options: {
      disableNew: true,
    },
    description: "この記事が引用・参照した元記事を紐付けます（任意）。",
  });
}

export function createSeoFields(options: OptionalFieldset = {}) {
  return [
    defineField({
      name: "seoTitle",
      title: "SEO Title",
      type: "string",
      fieldset: options.fieldset,
      description: "未入力時は title を使用",
    }),
    defineField({
      name: "seoDescription",
      title: "SEO Description",
      type: "text",
      rows: 3,
      fieldset: options.fieldset,
      description: "任意。未入力時は本文冒頭を利用",
    }),
    defineField({
      name: "ogImage",
      title: "OG Image",
      type: "image",
      fieldset: options.fieldset,
      options: {hotspot: true},
      description: "未入力時は heroImage を使用",
    }),
  ];
}

export const citationSourceArticleField = createCitationSourceArticleField();
export const seoFields = createSeoFields();
