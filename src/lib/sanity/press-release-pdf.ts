import {randomUUID} from "node:crypto";
import type {ParsedPressReleaseDocx, PortableTextBlock} from "./press-release-docx";

type PdfTextItem = {
  str?: string;
  transform?: number[];
};

type LineCandidate = {
  text: string;
  yRatio: number;
};

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

function isFooterLine(text: string) {
  const normalized = normalizeWhitespace(text);
  if (!normalized) return true;

  const patterns = [
    /^e-?mail[:：]/i,
    /@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/,
    /(お問い合わせ|報道関係|担当|広報|PR)\s*[:：]/,
    /(\d{2,4}-\d{2,4}-\d{3,4})/,
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

function splitOverlongSingleLine(lines: string[]) {
  if (lines.length !== 1) return lines;
  const only = normalizeWhitespace(lines[0]);
  if (only.length < 180) return lines;

  const chunks = only
    .split(/(?<=[。！？])/)
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean);

  // If sentence split failed, keep original behavior.
  if (chunks.length <= 1) return lines;
  return chunks;
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

function buildFallbackLinesFromItems(items: PdfTextItem[]) {
  const raw = items
    .map((item) => (typeof item.str === "string" ? item.str : ""))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  return splitBySentenceOrBreaks(raw);
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

function groupItemsToLines(items: PdfTextItem[], pageHeight: number): LineCandidate[] {
  const buckets = new Map<number, {y: number; tokens: Array<{x: number; text: string}>}>();
  for (const raw of items) {
    const token = typeof raw.str === "string" ? normalizeWhitespace(raw.str) : "";
    if (!token) continue;
    const transform = Array.isArray(raw.transform) ? raw.transform : [];
    const x = typeof transform[4] === "number" ? transform[4] : 0;
    const y = typeof transform[5] === "number" ? transform[5] : 0;
    const bucketKey = Math.round(y / 2) * 2;
    const found = buckets.get(bucketKey);
    if (found) {
      found.tokens.push({x, text: token});
      continue;
    }
    buckets.set(bucketKey, {y, tokens: [{x, text: token}]});
  }

  const lines = Array.from(buckets.values())
    .map((bucket) => {
      const text = bucket.tokens
        .sort((a, b) => a.x - b.x)
        .map((token) => token.text)
        .join("");
      const normalized = normalizeWhitespace(text);
      if (!normalized) return null;
      const safeHeight = pageHeight > 0 ? pageHeight : 1;
      return {
        text: normalized,
        yRatio: Math.max(0, Math.min(1, bucket.y / safeHeight)),
      };
    })
    .filter((line): line is LineCandidate => line !== null)
    .sort((a, b) => b.yRatio - a.yRatio);

  return lines;
}

function detectRepeatedHeaderFooterLines(pages: LineCandidate[][]) {
  const counts = new Map<string, number>();

  for (const lines of pages) {
    const uniques = new Set<string>();
    for (const line of lines) {
      const isHeaderFooterZone = line.yRatio >= 0.88 || line.yRatio <= 0.12;
      if (!isHeaderFooterZone) continue;
      uniques.add(line.text);
    }
    for (const text of uniques) {
      counts.set(text, (counts.get(text) ?? 0) + 1);
    }
  }

  const repeated = new Set<string>();
  for (const [text, count] of counts.entries()) {
    if (count >= 2) repeated.add(text);
  }
  return repeated;
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

async function parsePressReleasePdfWithPdfjs(buffer: Buffer): Promise<ParsedPressReleasePdf> {
  await ensureDomMatrixPolyfill();
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // Stabilize worker resolution in Next server bundle.
  pdfjs.GlobalWorkerOptions.workerSrc = "pdfjs-dist/legacy/build/pdf.worker.mjs";
  const loadingTask = pdfjs.getDocument({data: new Uint8Array(buffer)});
  const pdf = await loadingTask.promise;

  const pageLines: LineCandidate[][] = [];
  const itemFallbackLines: string[] = [];
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({scale: 1});
    const content = await page.getTextContent();
    const lines = groupItemsToLines(content.items as PdfTextItem[], viewport.height);
    pageLines.push(lines);
    itemFallbackLines.push(...buildFallbackLinesFromItems(content.items as PdfTextItem[]));
  }

  const repeatedHeaderFooter = detectRepeatedHeaderFooterLines(pageLines);
  const rawLines = pageLines.map((lines) =>
    lines
      .map((line) => normalizeWhitespace(line.text))
      .filter((text) => text && !repeatedHeaderFooter.has(text))
  );
  const filteredLines = rawLines.map((lines) => lines.filter((text) => !isMetadataLine(text)));

  const rawFlatLines = splitOverlongSingleLine(rawLines.flat().filter(Boolean));
  const filteredFlatLines = splitOverlongSingleLine(filteredLines.flat().filter(Boolean));
  const itemFallbackFlatLines = splitOverlongSingleLine(itemFallbackLines);
  if (rawFlatLines.length === 0 && itemFallbackFlatLines.length === 0) {
    throw new Error("PDFから本文を抽出できませんでした。");
  }

  const firstPageLines = filteredLines[0] ?? [];
  const firstPageRawLines = rawLines[0] ?? [];

  let usedFallback = false;
  let fallbackReason: string | undefined;
  const bodyCandidateLines =
    filteredFlatLines.length > 0
      ? filteredFlatLines
      : rawFlatLines.length > 1
      ? rawFlatLines
      : itemFallbackFlatLines.length > 0
      ? itemFallbackFlatLines
      : rawFlatLines;
  const title =
    chooseTitle(firstPageLines) ??
    chooseTitle(firstPageRawLines) ??
    chooseTitle(bodyCandidateLines) ??
    "PDFインポート（要編集）";
  if (filteredFlatLines.length === 0) {
    usedFallback = true;
    fallbackReason =
      itemFallbackFlatLines.length > 0 && rawFlatLines.length <= 1
        ? "all_lines_filtered_as_metadata_using_item_stream"
        : "all_lines_filtered_as_metadata";
  }

  const titleRemovedLines =
    title === "PDFインポート（要編集）"
      ? bodyCandidateLines
      : (() => {
          let removed = false;
          return bodyCandidateLines.filter((line) => {
            if (!removed && line === title) {
              removed = true;
              return false;
            }
            return true;
          });
        })();

  // Remove header-like lines from the beginning and footer-like lines from the end.
  const bodyCoreLines = [...titleRemovedLines];
  while (bodyCoreLines.length > 0) {
    const head = bodyCoreLines[0];
    if (!head) break;
    if (isEmbargoDateLine(head) || isFrontMatterLine(head) || isMetadataLine(head)) {
      bodyCoreLines.shift();
      continue;
    }
    break;
  }

  while (bodyCoreLines.length > 0) {
    const tail = bodyCoreLines[bodyCoreLines.length - 1];
    if (!tail) break;
    if (isFooterLine(tail) || isMetadataLine(tail)) {
      bodyCoreLines.pop();
      continue;
    }
    break;
  }

  const bodySourceLines = forceParagraphize(bodyCoreLines.length > 0 ? bodyCoreLines : titleRemovedLines);

  const body = bodySourceLines
    .map((line) => toPortableTextBlock(line))
    .filter((line): line is PortableTextBlock => line !== null);

  let finalBody = body;
  if (finalBody.length === 0) {
    usedFallback = true;
    fallbackReason = fallbackReason ?? "body_empty_after_front_footer_trim";
    finalBody = forceParagraphize(titleRemovedLines)
      .map((line) => toPortableTextBlock(line))
      .filter((line): line is PortableTextBlock => line !== null);
  }

  if (finalBody.length === 0) {
    throw new Error("PDFから本文を抽出できませんでした。");
  }

  const diagnostics: PdfParseDiagnostics = {
    totalPages: pdf.numPages,
    rawLineCount: rawFlatLines.length,
    repeatedHeaderFooterCount: repeatedHeaderFooter.size,
    metadataFilteredLineCount: rawFlatLines.length - filteredFlatLines.length,
    filteredLineCount: filteredFlatLines.length,
    bodyCandidateLineCount: bodyCandidateLines.length,
    bodyFinalLineCount: bodySourceLines.length,
    bodyBlockCount: finalBody.length,
    usedFallback,
    fallbackReason,
  };

  return {
    title,
    body: finalBody,
    plainText: normalizeWhitespace(bodySourceLines.join("\n\n")),
    diagnostics,
  };
}

async function parsePressReleasePdfWithPdfParse(buffer: Buffer): Promise<ParsedPressReleasePdf> {
  await ensureDomMatrixPolyfill();
  const pdfParseModule = await import("pdf-parse");
  const {PDFParse} = pdfParseModule;
  PDFParse.setWorker();
  const parser = new PDFParse({data: buffer});
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
      fallbackReason: "pdfjs_dommatrix_fallback_pdf_parse",
    },
  };
}

export async function parsePressReleasePdf(buffer: Buffer): Promise<ParsedPressReleasePdf> {
  try {
    return await parsePressReleasePdfWithPdfjs(buffer);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/DOMMatrix is not defined/i.test(message)) {
      throw error;
    }
    return parsePressReleasePdfWithPdfParse(buffer);
  }
}
