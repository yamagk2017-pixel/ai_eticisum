import {NextResponse} from "next/server";
import {parsePressReleaseDocx} from "@/lib/sanity/press-release-docx";
import {parsePressReleasePdf} from "@/lib/sanity/press-release-pdf";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({error: "ファイルが見つかりません。"}, {status: 400});
    }

    const name = file.name.toLowerCase();
    const isDocx = name.endsWith(".docx");
    const isPdf = name.endsWith(".pdf");

    if (!isDocx && !isPdf) {
      return NextResponse.json({error: ".docx / .pdf ファイルのみ対応しています。"}, {status: 400});
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const parsed = isPdf
      ? await parsePressReleasePdf(buffer)
      : await parsePressReleaseDocx(buffer);

    return NextResponse.json({
      title: parsed.title,
      body: parsed.body,
      plainText: parsed.plainText,
      bodyBlockCount: parsed.body.length,
      sourceType: isPdf ? "pdf" : "docx",
      diagnostics: "diagnostics" in parsed ? parsed.diagnostics : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "原稿の解析に失敗しました。";
    return NextResponse.json({error: message}, {status: 500});
  }
}
