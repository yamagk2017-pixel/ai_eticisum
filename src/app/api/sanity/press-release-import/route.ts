import {NextResponse} from "next/server";
import {parsePressReleaseDocx} from "@/lib/sanity/press-release-docx";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({error: "DOCXファイルが見つかりません。"}, {status: 400});
    }

    if (!file.name.toLowerCase().endsWith(".docx")) {
      return NextResponse.json({error: ".docx ファイルのみ対応しています。"}, {status: 400});
    }

    const arrayBuffer = await file.arrayBuffer();
    const parsed = await parsePressReleaseDocx(Buffer.from(arrayBuffer));

    return NextResponse.json({
      title: parsed.title,
      body: parsed.body,
      plainText: parsed.plainText,
      bodyBlockCount: parsed.body.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "DOCXの解析に失敗しました。";
    return NextResponse.json({error: message}, {status: 500});
  }
}
