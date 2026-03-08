"use client";

import {useState} from "react";
import {useClient} from "sanity";

type PortableTextSpan = {
  _type: "span";
  _key: string;
  text: string;
  marks: string[];
};

type PortableTextLinkMarkDef = {
  _key: string;
  _type: "link";
  href: string;
};

type PortableTextBlock = {
  _type: "block";
  _key: string;
  style: "normal" | "h2" | "h3";
  children: PortableTextSpan[];
  markDefs: PortableTextLinkMarkDef[];
};

type ImportResponse = {
  title: string;
  body: PortableTextBlock[];
  plainText: string;
  bodyBlockCount: number;
};

function buildDraftDocument(payload: ImportResponse) {
  return {
    _id: `drafts.${window.crypto.randomUUID()}`,
    _type: "newsArticle",
    title: payload.title,
    body: payload.body,
  };
}

export function DocxPressReleaseImportTool() {
  const client = useClient({apiVersion: "2026-02-24"});
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ImportResponse | null>(null);
  const [createdTitle, setCreatedTitle] = useState<string | null>(null);

  async function handleParse() {
    if (!selectedFile) {
      setParseError("先に .docx ファイルを選択してください。");
      return;
    }
    setIsParsing(true);
    setParseError(null);
    setCreateError(null);
    setCreatedTitle(null);

    try {
      const formData = new FormData();
      formData.set("file", selectedFile);
      const response = await fetch("/api/sanity/press-release-import", {
        method: "POST",
        body: formData,
      });
      const json = (await response.json()) as ImportResponse & {error?: string};
      if (!response.ok) {
        throw new Error(json.error || "DOCXの解析に失敗しました。");
      }
      setParsed(json);
    } catch (error) {
      setParsed(null);
      setParseError(error instanceof Error ? error.message : "DOCXの解析に失敗しました。");
    } finally {
      setIsParsing(false);
    }
  }

  async function handleCreateDraft() {
    if (!parsed) return;
    setIsCreating(true);
    setCreateError(null);

    try {
      const draft = buildDraftDocument(parsed);
      await client.create(draft);
      setCreatedTitle(parsed.title);
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "下書き作成に失敗しました。");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div style={{padding: 24}}>
      <div style={{display: "grid", gap: 16}}>
        <div>
          <h2 style={{fontSize: 24, fontWeight: 700, margin: 0}}>DOCX原稿インポート</h2>
          <p style={{marginTop: 8, color: "#6b7280", lineHeight: 1.7}}>
            .docx を読み込み、`newsArticle` の下書きにタイトルと本文を流し込みます。画像・カテゴリ・タグ・関連グループ・SEOは後で手入力します。
          </p>
        </div>

        <div
          style={{
            border: "1px solid #d4d4d8",
            borderRadius: 12,
            padding: 16,
            background: "#fafafa",
          }}
        >
          <div style={{fontSize: 14, fontWeight: 700, marginBottom: 8}}>手順</div>
          <div style={{fontSize: 14, color: "#52525b", lineHeight: 1.8}}>
            1. `DOCXファイルを選択` から原稿を選ぶ
            <br />
            2. `DOCXを解析` でタイトルと本文を抽出する
            <br />
            3. `newsArticle 下書きを作成` で投稿下書きを作る
          </div>
        </div>

        <div style={{border: "1px solid #d4d4d8", borderRadius: 12, padding: 16, display: "grid", gap: 12}}>
          <label
            style={{
              display: "grid",
              gap: 10,
              border: "2px dashed #a1a1aa",
              borderRadius: 12,
              padding: 20,
              background: "#fafafa",
              cursor: "pointer",
            }}
          >
            <input
              type="file"
              accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              style={{display: "none"}}
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                if (file && !file.name.toLowerCase().endsWith(".docx")) {
                  setSelectedFile(null);
                  setParsed(null);
                  setParseError(".docx ファイルのみ対応しています。");
                  setCreateError(null);
                  setCreatedTitle(null);
                  return;
                }

                setSelectedFile(file);
                setParsed(null);
                setParseError(null);
                setCreateError(null);
                setCreatedTitle(null);
              }}
            />
            <div style={{display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap"}}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 10,
                  border: "1px solid #18181b",
                  background: "#18181b",
                  color: "#fff",
                  padding: "10px 16px",
                  fontSize: 14,
                  fontWeight: 700,
                }}
              >
                DOCXファイルを選択
              </span>
              <span style={{fontSize: 13, color: "#6b7280"}}>.docx のみ対応</span>
            </div>
            <div style={{fontSize: 13, color: "#6b7280"}}>
              {selectedFile ? `選択中: ${selectedFile.name}` : "まだファイルは選択されていません"}
            </div>
          </label>

          <div style={{fontSize: 13, color: "#6b7280"}}>
            受け取ったプレスリリース原稿から、タイトルと本文のみを抽出します。
          </div>
          <div style={{display: "flex", gap: 12, flexWrap: "wrap"}}>
            <button
              type="button"
              disabled={isParsing}
              onClick={handleParse}
              style={{
                borderRadius: 10,
                border: "1px solid #18181b",
                background: isParsing ? "#d4d4d8" : "#18181b",
                color: "#fff",
                padding: "10px 16px",
                cursor: isParsing ? "not-allowed" : "pointer",
              }}
            >
              {isParsing ? "解析中..." : "DOCXを解析"}
            </button>
            {parsed ? (
              <button
                type="button"
                disabled={isCreating}
                onClick={handleCreateDraft}
                style={{
                  borderRadius: 10,
                  border: "1px solid #15803d",
                  background: isCreating ? "#bbf7d0" : "#15803d",
                  color: "#fff",
                  padding: "10px 16px",
                  cursor: isCreating ? "not-allowed" : "pointer",
                }}
              >
                {isCreating ? "下書き作成中..." : "newsArticle 下書きを作成"}
              </button>
            ) : null}
          </div>
        </div>

        {parseError ? (
          <div style={{border: "1px solid #fca5a5", background: "#fef2f2", color: "#991b1b", borderRadius: 12, padding: 16}}>
            {parseError}
          </div>
        ) : null}

        {createError ? (
          <div style={{border: "1px solid #fca5a5", background: "#fef2f2", color: "#991b1b", borderRadius: 12, padding: 16}}>
            {createError}
          </div>
        ) : null}

        {createdTitle ? (
          <div style={{border: "1px solid #86efac", background: "#f0fdf4", color: "#166534", borderRadius: 12, padding: 16}}>
            下書きを作成しました。`News Article (Sanity / New)` の一覧から「{createdTitle}」を開いて続きの入力をしてください。
          </div>
        ) : null}

        {parsed ? (
          <>
            <div style={{border: "1px solid #d4d4d8", borderRadius: 12, padding: 16}}>
              <div style={{fontWeight: 700, marginBottom: 8}}>抽出タイトル</div>
              <div>{parsed.title}</div>
            </div>

            <div style={{border: "1px solid #d4d4d8", borderRadius: 12, padding: 16}}>
              <div style={{fontWeight: 700, marginBottom: 8}}>本文プレビュー</div>
              <div style={{fontSize: 13, color: "#6b7280", marginBottom: 12}}>ブロック数: {parsed.bodyBlockCount}</div>
              <div
                style={{
                  maxHeight: 360,
                  overflow: "auto",
                  border: "1px solid #e4e4e7",
                  borderRadius: 10,
                  padding: 16,
                  whiteSpace: "pre-wrap",
                  lineHeight: 1.8,
                }}
              >
                {parsed.plainText || "本文が空です。"}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
