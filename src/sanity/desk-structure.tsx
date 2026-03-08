import type {StructureResolver} from "sanity/structure";
import {DocxPressReleaseImportTool} from "@/sanity/components/docx-press-release-import-tool";

export const deskStructure: StructureResolver = (S) =>
  S.list()
    .title("Content")
    .items([
      S.listItem()
        .id("docx-press-release-import")
        .title("DOCX原稿インポート")
        .child(
          S.component()
            .id("docx-press-release-import-pane")
            .title("DOCX原稿インポート")
            .component(DocxPressReleaseImportTool)
        ),
      ...S.documentTypeListItems(),
    ]);
