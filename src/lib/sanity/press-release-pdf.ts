import {randomUUID} from "node:crypto";
import type {ParsedPressReleaseDocx, PortableTextBlock} from "./press-release-docx";

type InlinePart = {
  text: string;
  href?: string;
};

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

type PdfParseDiagnostics = {
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
};

export type ParsedPressReleasePdf = ParsedPressReleaseDocx & {
  diagnostics: PdfParseDiagnostics;
};

async function ensureDomMatrixPolyfill() {
  if (typeof globalThis.DOMMatrix !== "undefined") return;

  const domMatrixModule = await import("@thednp/dommatrix");
  const DOMMatrixClass = domMatrixModule.default as unknown as typeof DOMMatrix;

  // pdfjs checks global DOMMatrix in some runtimes (e.g. Vercel Node).
  (globalThis as typeof globalThis & {DOMMatrix?: typeof DOMMatrix}).DOMMatrix = DOMMatrixClass;
}

function createKey() {
  return randomUUID().replace(/-/g, "").slice(0, 12);
}

function normalizeWhitespace(value: string) {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function isEmbargoDateLine(value: string) {
  const text = normalizeWhitespace(value);
  if (!text) return false;

  const hasEmbargoKeyword =
    /(情報解禁|解禁日時|公開日時|配信日時|リリース日時|発表日時|掲載解禁|公開解禁|解禁日|解禁)/.test(text);
  const hasDatePattern =
    /\d{4}\s*[\/\-年\.]\s*\d{1,2}\s*[\/\-月\.]\s*\d{1,2}(?:\s*日)?/.test(text) ||
    /\d{1,2}\s*[:：]\s*\d{2}/.test(text) ||
    /(午前|午後|AM|PM|am|pm)/.test(text);

  if (hasEmbargoKeyword && hasDatePattern) return true;

  if (!hasEmbargoKeyword && hasDatePattern) {
    const nonDateText = text
      .replace(/\d{1,4}/g, "")
      .replace(/[\/\-:\.：]/g, "")
      .replace(/[年月日時分秒]/g, "")
      .replace(/(午前|午後|AM|PM|am|pm)/g, "")
      .replace(/[()（）\[\]【】]/g, "")
      .replace(/\s+/g, "");
    if (nonDateText.length === 0) return true;
  }

  return false;
}

function isFrontMatterLine(text: string) {
  const normalized = normalizeWhitespace(text);
  if (!normalized) return true;

  const patterns = [
    /^報道関係各位$/,
    /^プレスリリース$/i,
    /^news\s*release$/i,
    /^情報解禁[:：]/,
    /^解禁[:：]/,
    /^株式会社[\p{L}\p{N}・＆&\-\s]+$/u,
  ];
  return patterns.some((pattern) => pattern.test(normalized));
}

function isMetadataLine(text: string) {
  const normalized = normalizeWhitespace(text);
  if (!normalized) return true;
  if (normalized.length <= 2) return true;

  // Long prose lines should not be dropped as metadata, even if they contain
  // words like "お問い合わせ" somewhere in the sentence.
  if (normalized.length >= 140 && /[。！？]/.test(normalized)) {
    return false;
  }

  const patterns = [
    /^page\s*\d+(\s*\/\s*\d+)?$/i,
    /^-?\s*\d+\s*-?$/,
    /^(copyright|all rights reserved)/i,
    /(お問い合わせ|会社概要|所在地|代表者|報道関係者|担当者|発行元|配信元|〒|TEL|FAX)/i,
  ];

  return patterns.some((pattern) => pattern.test(normalized));
}

function forceParagraphize(lines: string[]) {
  if (lines.length !== 1) return lines;
  const only = normalizeWhitespace(lines[0]);
  if (!only) return [];

  const sentenceParts = only
    .split(/(?<=[。！？.!?])/)
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean);
  if (sentenceParts.length > 1) return sentenceParts;

  const anchorParts = only
    .replace(/\s+(https?:\/\/)/g, "\n$1")
    .replace(/\s+([●■◆▼▷▶※]+)/g, "\n$1")
    .replace(/\s+([【\[])/g, "\n$1")
    .replace(/\s+(株式会社|有限会社|合同会社|報道関係各位|お問い合わせ|E-?mail[:：]|URL[:：])/g, "\n$1")
    .split("\n")
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean);
  if (anchorParts.length > 1) return anchorParts;

  const hardChunks: string[] = [];
  const maxChunk = 90;
  let rest = only;
  while (rest.length > maxChunk) {
    let cut = maxChunk;
    const near = rest.slice(0, maxChunk + 20);
    const punct = Math.max(near.lastIndexOf("。"), near.lastIndexOf(" "), near.lastIndexOf("　"));
    if (punct > 30) cut = punct + 1;
    hardChunks.push(normalizeWhitespace(rest.slice(0, cut)));
    rest = rest.slice(cut);
  }
  if (normalizeWhitespace(rest)) hardChunks.push(normalizeWhitespace(rest));
  return hardChunks.filter(Boolean);
}

function splitBySentenceOrBreaks(text: string) {
  const normalized = normalizeWhitespace(text);
  if (!normalized) return [];

  const byBreaks = normalized
    .split(/\n{2,}|(?:\s{2,})/)
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean);

  const source = byBreaks.length > 1 ? byBreaks : [normalized];
  const sentenceSplit = source
    .flatMap((part) => part.split(/(?<=[。！？])/))
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean);

  if (sentenceSplit.length > 1) return sentenceSplit;

  // Last-resort split for PDFs that collapse everything into one long line.
  // Prefer semantic anchors before hard chunking.
  const anchored = normalized
    .replace(/\s+(https?:\/\/)/g, "\n$1")
    .replace(/\s+([●■◆▼▷▶※]+)/g, "\n$1")
    .replace(/\s+([【\[])/g, "\n$1")
    .replace(/\s+(株式会社|有限会社|合同会社|報道関係各位|お問い合わせ|E-?mail[:：])/g, "\n$1")
    .split("\n")
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean);

  if (anchored.length > 1) return anchored;

  // Absolute fallback: fixed-length chunks to avoid body=1 block.
  const maxChunk = 120;
  const chunks: string[] = [];
  let rest = normalized;
  while (rest.length > maxChunk) {
    let cut = maxChunk;
    const near = rest.slice(0, maxChunk + 20);
    const punct = Math.max(near.lastIndexOf("。"), near.lastIndexOf(" "), near.lastIndexOf("　"));
    if (punct > 40) cut = punct + 1;
    chunks.push(normalizeWhitespace(rest.slice(0, cut)));
    rest = rest.slice(cut);
  }
  if (normalizeWhitespace(rest)) chunks.push(normalizeWhitespace(rest));
  return chunks.filter(Boolean);
}

function splitTextWithUrls(value: string): InlinePart[] {
  const normalized = normalizeWhitespace(value);
  if (!normalized) return [];

  const urlPattern = /(https?:\/\/[^\s)]+[^\s.,)])/g;
  const parts: InlinePart[] = [];
  let lastIndex = 0;

  for (const match of normalized.matchAll(urlPattern)) {
    const index = match.index ?? 0;
    const matchedUrl = match[0];
    const before = normalized.slice(lastIndex, index);
    if (before) parts.push({text: before});
    parts.push({text: matchedUrl, href: matchedUrl});
    lastIndex = index + matchedUrl.length;
  }

  const rest = normalized.slice(lastIndex);
  if (rest) parts.push({text: rest});
  return parts;
}

function toPortableTextBlock(text: string): PortableTextBlock | null {
  const parts = splitTextWithUrls(text);
  if (parts.length === 0) return null;

  const markDefs: PortableTextLinkMarkDef[] = [];
  const children: PortableTextSpan[] = parts.map((part) => {
    const markKey = part.href ? createKey() : null;
    if (markKey && part.href) {
      markDefs.push({_key: markKey, _type: "link", href: part.href});
    }

    return {
      _type: "span",
      _key: createKey(),
      text: part.text,
      marks: markKey ? [markKey] : [],
    };
  });

  return {
    _type: "block",
    _key: createKey(),
    style: "normal",
    children,
    markDefs,
  };
}

function chooseTitle(lines: string[]) {
  for (const line of lines) {
    const text = normalizeWhitespace(line);
    if (!text) continue;
    if (isMetadataLine(text)) continue;
    if (isFrontMatterLine(text)) continue;
    if (isEmbargoDateLine(text)) continue;
    if (/^https?:\/\//i.test(text)) continue;
    if (text.length < 6) continue;
    return text.slice(0, 200);
  }
  return null;
}

async function parsePressReleasePdfWithPdfParse(buffer: Buffer): Promise<ParsedPressReleasePdf> {
  await ensureDomMatrixPolyfill();
  const pdfParseModule = await import("pdf-parse");
  const {PDFParse} = pdfParseModule;
  const parser = new PDFParse({data: buffer, disableWorker: true} as unknown as ConstructorParameters<
    typeof PDFParse
  >[0]);
  const parsed = await parser.getText();
  await parser.destroy();
  const rawText = normalizeWhitespace(parsed.text ?? "");
  if (!rawText) {
    throw new Error("PDFから本文を抽出できませんでした。");
  }

  const lines = splitBySentenceOrBreaks(rawText);
  const title = chooseTitle(lines) ?? "PDFインポート（要編集）";

  const withoutTitle =
    title === "PDFインポート（要編集）"
      ? lines
      : (() => {
          let removed = false;
          return lines.filter((line) => {
            if (!removed && line === title) {
              removed = true;
              return false;
            }
            return true;
          });
        })();

  const bodySourceLines = forceParagraphize(withoutTitle.length > 0 ? withoutTitle : lines);
  const body = bodySourceLines
    .map((line) => toPortableTextBlock(line))
    .filter((line): line is PortableTextBlock => line !== null);

  if (body.length === 0) {
    throw new Error("PDFから本文を抽出できませんでした。");
  }

  return {
    title,
    body,
    plainText: normalizeWhitespace(bodySourceLines.join("\n\n")),
    diagnostics: {
      totalPages: parsed.total ?? 0,
      rawLineCount: lines.length,
      repeatedHeaderFooterCount: 0,
      metadataFilteredLineCount: 0,
      filteredLineCount: lines.length,
      bodyCandidateLineCount: lines.length,
      bodyFinalLineCount: bodySourceLines.length,
      bodyBlockCount: body.length,
      usedFallback: true,
      fallbackReason: "pdf_parse_primary",
    },
  };
}

export async function parsePressReleasePdf(buffer: Buffer): Promise<ParsedPressReleasePdf> {
  return parsePressReleasePdfWithPdfParse(buffer);
}
