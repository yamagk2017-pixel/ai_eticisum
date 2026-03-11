import {randomUUID} from "node:crypto";
import type {ParsedPressReleaseDocx, PortableTextBlock} from "./press-release-docx";
import PDFParser from "pdf2json";

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

function normalizeJapaneseSpacing(value: string) {
  const urls: string[] = [];
  const protectedText = value.replace(/https?:\/\/[^\s)]+[^\s.,)]/g, (match) => {
    const token = `__URL_${urls.length}__`;
    urls.push(match);
    return token;
  });

  const compacted = protectedText
    .replace(
      /([\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}ー々〆ヵヶ])\s+([\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}ー々〆ヵヶ])/gu,
      "$1$2"
    )
    .replace(/\s+([、。！？：；）」』】])/g, "$1")
    .replace(/([（「『【])\s+/g, "$1")
    .replace(/\s{2,}/g, " ");

  return compacted.replace(/__URL_(\d+)__/g, (_, indexText) => urls[Number(indexText)] ?? "");
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

function compactBodyLines(lines: string[]) {
  const cleaned = lines.map((line) => normalizeJapaneseSpacing(normalizeWhitespace(line))).filter(Boolean);
  if (cleaned.length <= 1) return cleaned;

  const results: string[] = [];
  let current = "";

  const startsNewBlock = (line: string) =>
    /^(?:[・●■◆▼▷▶※]|[-*]|[0-9０-９]+[.)．])/.test(line) ||
    /^https?:\/\//i.test(line) ||
    /^【.+】$/.test(line) ||
    /^［.+］$/.test(line);

  for (const line of cleaned) {
    if (!current) {
      current = line;
      continue;
    }

    const shouldBreak =
      startsNewBlock(line) ||
      startsNewBlock(current) ||
      /[。！？.!?]$/.test(current) ||
      current.length >= 80;

    if (shouldBreak) {
      results.push(current);
      current = line;
      continue;
    }

    current = normalizeJapaneseSpacing(`${current}${line}`);
  }

  if (current) results.push(current);
  return results.filter(Boolean);
}

function splitBySentenceOrBreaks(text: string) {
  const normalized = normalizeJapaneseSpacing(normalizeWhitespace(text));
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
  const normalized = normalizeJapaneseSpacing(normalizeWhitespace(value));
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

async function parsePressReleasePdfLocal(buffer: Buffer): Promise<ParsedPressReleasePdf> {
  const parsed = await parsePdfTextWithPdf2Json(buffer);
  const rawLines = parsed.pageLines.flat().map((line) => normalizeJapaneseSpacing(normalizeWhitespace(line))).filter(Boolean);
  if (rawLines.length === 0) {
    throw new Error("PDFから本文を抽出できませんでした。");
  }

  const repeatedHeaderFooter = detectRepeatedHeaderFooterLines(parsed.pageLines);
  const linesWithoutRepeated = rawLines.filter((line) => !repeatedHeaderFooter.has(line));
  const filteredLines = linesWithoutRepeated.filter(
    (line) => !isMetadataLine(line) && !isFrontMatterLine(line) && !isEmbargoDateLine(line)
  );

  const lines = filteredLines.length > 0 ? filteredLines : linesWithoutRepeated;
  const expandedLines = lines.flatMap((line) => splitBySentenceOrBreaks(line));
  const title = chooseTitle(expandedLines) ?? "PDFインポート（要編集）";

  const withoutTitle =
    title === "PDFインポート（要編集）"
      ? expandedLines
      : (() => {
          let removed = false;
          return expandedLines.filter((line) => {
            if (!removed && line === title) {
              removed = true;
              return false;
            }
            return true;
          });
        })();

  const bodySourceLines = compactBodyLines(forceParagraphize(withoutTitle.length > 0 ? withoutTitle : lines));
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
      totalPages: parsed.totalPages,
      rawLineCount: rawLines.length,
      repeatedHeaderFooterCount: repeatedHeaderFooter.size,
      metadataFilteredLineCount: linesWithoutRepeated.length - filteredLines.length,
      filteredLineCount: lines.length,
      bodyCandidateLineCount: expandedLines.length,
      bodyFinalLineCount: bodySourceLines.length,
      bodyBlockCount: body.length,
      usedFallback: filteredLines.length === 0,
      fallbackReason: filteredLines.length === 0 ? "all_lines_filtered_as_metadata" : undefined,
    },
  };
}

export async function parsePressReleasePdf(buffer: Buffer): Promise<ParsedPressReleasePdf> {
  return parsePressReleasePdfLocal(buffer);
}
function decodePdf2JsonText(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function detectRepeatedHeaderFooterLines(pageLines: string[][]) {
  const counts = new Map<string, number>();
  for (const lines of pageLines) {
    const unique = new Set(lines.filter((line) => line.length > 0 && line.length <= 120));
    for (const line of unique) {
      counts.set(line, (counts.get(line) ?? 0) + 1);
    }
  }
  const repeated = new Set<string>();
  for (const [line, count] of counts.entries()) {
    if (count >= 2) repeated.add(line);
  }
  return repeated;
}

async function parsePdfTextWithPdf2Json(buffer: Buffer): Promise<{totalPages: number; pageLines: string[][]}> {
  return new Promise((resolve, reject) => {
    const parser = new PDFParser();
    parser.on("pdfParser_dataError", (error: unknown) => {
      const message =
        typeof error === "object" && error !== null && "parserError" in error
          ? String((error as {parserError?: unknown}).parserError ?? "PDF parse failed")
          : "PDF parse failed";
      reject(new Error(message));
    });
    parser.on("pdfParser_dataReady", (data: unknown) => {
      const pages =
        typeof data === "object" &&
        data !== null &&
        "Pages" in data &&
        Array.isArray((data as {Pages?: unknown[]}).Pages)
          ? ((data as {Pages: Array<{Texts?: Array<{R?: Array<{T?: string}>}>}>}).Pages ?? [])
          : [];

      const pageLines = pages.map((page) => {
        const texts = (page.Texts ?? [])
          .map((textItem) => {
            const y = typeof (textItem as {y?: unknown}).y === "number" ? (textItem as {y: number}).y : 0;
            const x = typeof (textItem as {x?: unknown}).x === "number" ? (textItem as {x: number}).x : 0;
            const text = (textItem.R ?? [])
              .map((run) => (typeof run.T === "string" ? decodePdf2JsonText(run.T) : ""))
              .join("")
              .trim();
            return {x, y, text};
          })
          .filter((item) => item.text.length > 0);

        const buckets = new Map<number, Array<{x: number; text: string}>>();
        for (const item of texts) {
          const key = Math.round(item.y * 10) / 10;
          const row = buckets.get(key) ?? [];
          row.push({x: item.x, text: item.text});
          buckets.set(key, row);
        }

        return Array.from(buckets.entries())
          .sort((a, b) => a[0] - b[0])
          .map(([, row]) =>
            normalizeJapaneseSpacing(
              normalizeWhitespace(
                row
                  .sort((a, b) => a.x - b.x)
                  .map((item) => item.text)
                  .join(" ")
              )
            )
          )
          .filter(Boolean);
      });

      resolve({totalPages: pages.length, pageLines});
    });
    parser.parseBuffer(buffer);
  });
}
