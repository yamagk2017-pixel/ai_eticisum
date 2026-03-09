"use client";

import {useState, type DragEvent} from "react";
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
  sourceType?: "docx" | "pdf";
  diagnostics?: {
    totalPages: number;
    rawLineCount: number;
    repeatedHeaderFooterCount: number;
    metadataFilteredLineCount: number;
    filteredLineCount: number;
    bodyCandidateLineCount: number;
    bodyFinalLineCount: number;
    bodyBlockCount: number;
    usedFallback: boolean;
    fallbackReason?: string;
  } | null;
};

function createKey() {
  return window.crypto.randomUUID().replace(/-/g, "").slice(0, 12);
}

function toPortableTextBlocksFromPlainText(value: string): PortableTextBlock[] {
  const urlPattern = /(https?:\/\/[^\s)]+[^\s.,)])/g;
  return value
    .split(/\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((paragraph) => {
      const markDefs: PortableTextLinkMarkDef[] = [];
      const children: PortableTextSpan[] = [];
      let lastIndex = 0;

      for (const match of paragraph.matchAll(urlPattern)) {
        const index = match.index ?? 0;
        const matchedUrl = match[0];
        const before = paragraph.slice(lastIndex, index);
        if (before) {
          children.push({_type: "span", _key: createKey(), text: before, marks: []});
        }

        const markKey = createKey();
        markDefs.push({_key: markKey, _type: "link", href: matchedUrl});
        children.push({_type: "span", _key: createKey(), text: matchedUrl, marks: [markKey]});
        lastIndex = index + matchedUrl.length;
      }

      const rest = paragraph.slice(lastIndex);
      if (rest) {
        children.push({_type: "span", _key: createKey(), text: rest, marks: []});
      }

      if (children.length === 0) {
        children.push({_type: "span", _key: createKey(), text: paragraph, marks: []});
      }

      return {
        _type: "block",
        _key: createKey(),
        style: "normal",
        children,
        markDefs,
      };
    });
}

function buildDraftDocument(title: string, bodyText: string, type: "newsArticle" | "eventAnnouncement") {
  const body = toPortableTextBlocksFromPlainText(bodyText);
  return {
    _id: `drafts.${window.crypto.randomUUID()}`,
    _type: type,
    title,
    body,
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
  const [createdType, setCreatedType] = useState<"newsArticle" | "eventAnnouncement" | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftBodyText, setDraftBodyText] = useState("");

  function isSupportedFile(file: File) {
    const lower = file.name.toLowerCase();
    return lower.endsWith(".docx") || lower.endsWith(".pdf");
  }

  function setIncomingFile(file: File | null) {
    if (file && !isSupportedFile(file)) {
      setSelectedFile(null);
      setParsed(null);
      setParseError(".docx / .pdf ファイルのみ対応しています。");
      setCreateError(null);
      setCreatedTitle(null);
      setCreatedType(null);
      return;
    }

    setSelectedFile(file);
    setParsed(null);
    setParseError(null);
    setCreateError(null);
    setCreatedTitle(null);
    setCreatedType(null);
  }

  function handleDropZoneDragOver(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (!isDragOver) setIsDragOver(true);
  }

  function handleDropZoneDragLeave(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(false);
  }

  function handleDropZoneDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(false);
    const file = event.dataTransfer.files?.[0] ?? null;
    setIncomingFile(file);
  }

  async function handleParse() {
    if (!selectedFile) {
      setParseError("先に原稿ファイル（.docx / .pdf）を選択してください。");
      return;
    }

    setIsParsing(true);
    setParseError(null);
    setCreateError(null);
    setCreatedTitle(null);
    setCreatedType(null);

    try {
      const formData = new FormData();
      formData.set("file", selectedFile);
      const response = await fetch("/api/sanity/press-release-import", {
        method: "POST",
        body: formData,
      });
      const json = (await response.json()) as ImportResponse & {error?: string};
      if (!response.ok) {
        throw new Error(json.error || "原稿の解析に失敗しました。");
      }

      setParsed(json);
      setDraftTitle(json.title ?? "");
      setDraftBodyText(json.plainText ?? "");
    } catch (error) {
      setParsed(null);
      setParseError(error instanceof Error ? error.message : "原稿の解析に失敗しました。");
    } finally {
      setIsParsing(false);
    }
  }

  async function handleCreateDraft(type: "newsArticle" | "eventAnnouncement") {
    const title = draftTitle.trim();
    const bodyText = draftBodyText.trim();
    if (!title) {
      setCreateError("タイトルを入力してください。");
      return;
    }
    if (!bodyText) {
      setCreateError("本文を入力してください。");
      return;
    }

    setIsCreating(true);
    setCreateError(null);

    try {
      const draft = buildDraftDocument(title, bodyText, type);
      await client.create(draft);
      setCreatedTitle(title);
      setCreatedType(type);
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "下書き作成に失敗しました。");
    } finally {
      setIsCreating(false);
    }
  }

  const pdfLowConfidence =
    parsed?.sourceType === "pdf" &&
    !!parsed.diagnostics &&
    parsed.diagnostics.rawLineCount <= 1 &&
    parsed.diagnostics.bodyBlockCount <= 1;

  return (
    <div style={{padding: 24}}>
      <div style={{display: "grid", gap: 28}}>
        <div>
          <h2 style={{fontSize: 24, fontWeight: 700, margin: 0}}>原稿インポート</h2>
          <p style={{marginTop: 8, color: "#6b7280", lineHeight: 1.7}}>
            .docx / .pdf を読み込み、タイトルと本文を下書きに流し込みます。抽出精度が低い場合はそのまま手動編集してください。
          </p>
        </div>

        <div style={{padding: 0, display: "grid", gap: 12}}>
          <label
            style={{
              display: "grid",
              gap: 10,
              border: "none",
              borderRadius: 12,
              padding: 20,
              background: isDragOver ? "#3f3f46" : "#27272a",
              cursor: "pointer",
            }}
            onDragOver={handleDropZoneDragOver}
            onDragLeave={handleDropZoneDragLeave}
            onDrop={handleDropZoneDrop}
          >
            <input
              type="file"
              accept=".docx,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf"
              style={{display: "none"}}
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                setIncomingFile(file);
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
                原稿ファイルを選択
              </span>
              <span style={{fontSize: 13, color: "#ffffff"}}>.docx / .pdf 対応</span>
            </div>
            <div style={{fontSize: 13, color: "#ffffff"}}>
              {selectedFile
                ? `選択中: ${selectedFile.name}`
                : isDragOver
                ? "ここにファイルをドロップしてください"
                : "まだファイルは選択されていません（ドラッグ＆ドロップ対応）"}
            </div>
          </label>

          <div style={{display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "flex-end"}}>
            <button
              type="button"
              disabled={isCreating}
              onClick={() => handleCreateDraft("newsArticle")}
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
            <button
              type="button"
              disabled={isCreating}
              onClick={() => handleCreateDraft("eventAnnouncement")}
              style={{
                borderRadius: 10,
                border: "1px solid #334155",
                background: isCreating ? "#cbd5e1" : "#334155",
                color: "#fff",
                padding: "10px 16px",
                cursor: isCreating ? "not-allowed" : "pointer",
              }}
            >
              {isCreating ? "下書き作成中..." : "eventAnnouncement 下書きを作成"}
            </button>
            <button
              type="button"
              disabled={isParsing}
              onClick={handleParse}
              style={{
                borderRadius: 10,
                border: "1px solid #d4d4d8",
                background: isParsing ? "#d4d4d8" : "#18181b",
                color: "#fff",
                padding: "10px 16px",
                cursor: isParsing ? "not-allowed" : "pointer",
              }}
            >
              {isParsing ? "解析中..." : "原稿を解析"}
            </button>
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
            下書きを作成しました（{createdType === "eventAnnouncement" ? "eventAnnouncement" : "newsArticle"}）。
            一覧から「{createdTitle}」を開いて続きの入力をしてください。
          </div>
        ) : null}

        <div style={{padding: 0}}>
          <div style={{fontWeight: 700, marginBottom: 8}}>タイトル（編集可）</div>
          {parsed ? <div style={{fontSize: 13, color: "#6b7280", marginBottom: 6}}>解析元: {parsed.sourceType === "pdf" ? "PDF" : "DOCX"}</div> : null}
          {parsed?.sourceType === "pdf" && parsed.diagnostics ? (
            <div style={{fontSize: 12, color: "#71717a", marginBottom: 8}}>
              lines(raw/filter/final): {parsed.diagnostics.rawLineCount} / {parsed.diagnostics.filteredLineCount} / {parsed.diagnostics.bodyFinalLineCount}
              {parsed.diagnostics.usedFallback ? `（fallback: ${parsed.diagnostics.fallbackReason ?? "enabled"}）` : ""}
            </div>
          ) : null}
          {pdfLowConfidence ? (
            <div
              style={{
                border: "1px solid #f59e0b",
                background: "#fffbeb",
                color: "#92400e",
                borderRadius: 10,
                padding: 12,
                marginBottom: 10,
                fontSize: 13,
              }}
            >
              このPDFは自動抽出対象外です。手動編集して下書きを作成してください。
            </div>
          ) : null}
          <input
            type="text"
            value={draftTitle}
            onChange={(event) => setDraftTitle(event.target.value)}
            style={{
              width: "100%",
              border: "1px solid #d4d4d8",
              borderRadius: 10,
              padding: "10px 12px",
              fontSize: 14,
            }}
          />
        </div>

        <div style={{padding: 0}}>
          <div style={{fontWeight: 700, marginBottom: 8}}>本文（編集可）</div>
          {parsed ? <div style={{fontSize: 13, color: "#6b7280", marginBottom: 12}}>ブロック数: {parsed.bodyBlockCount}</div> : null}
          <textarea
            value={draftBodyText}
            onChange={(event) => setDraftBodyText(event.target.value)}
            style={{
              width: "100%",
              minHeight: 320,
              border: "1px solid #e4e4e7",
              borderRadius: 10,
              padding: 16,
              whiteSpace: "pre-wrap",
              lineHeight: 1.8,
              fontSize: 14,
            }}
          />
        </div>
      </div>
    </div>
  );
}
