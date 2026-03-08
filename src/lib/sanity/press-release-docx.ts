import {randomUUID} from "node:crypto";
import mammoth from "mammoth";

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

export type PortableTextBlock = {
  _type: "block";
  _key: string;
  style: "normal" | "h2" | "h3";
  children: PortableTextSpan[];
  markDefs: PortableTextLinkMarkDef[];
};

type ParsedHtmlBlock = {
  tag: "p" | "h1" | "h2" | "h3";
  html: string;
};

type InlinePart = {
  text: string;
  href?: string;
};

export type ParsedPressReleaseDocx = {
  title: string;
  body: PortableTextBlock[];
  plainText: string;
};

function createKey() {
  return randomUUID().replace(/-/g, "").slice(0, 12);
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripTags(value: string) {
  return decodeHtmlEntities(
    value
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<[^>]+>/g, "")
  );
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
    /(情報解禁|解禁日時|公開日時|配信日時|リリース日時|発表日時|掲載解禁|公開解禁|解禁日)/.test(text);
  const hasDatePattern =
    /\d{4}\s*[\/\-年\.]\s*\d{1,2}\s*[\/\-月\.]\s*\d{1,2}(?:\s*日)?/.test(text) ||
    /\d{1,2}\s*[:：]\s*\d{2}/.test(text) ||
    /(午前|午後|AM|PM|am|pm)/.test(text);

  if (hasEmbargoKeyword && hasDatePattern) return true;

  // Date/time-only heading often appears before title in press release docs.
  // To avoid false positives, only treat it as a date line when non-date text is effectively empty.
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

function extractHtmlBlocks(html: string): ParsedHtmlBlock[] {
  const matches = html.matchAll(/<(p|h1|h2|h3)[^>]*>([\s\S]*?)<\/\1>/gi);
  const blocks: ParsedHtmlBlock[] = [];

  for (const match of matches) {
    const tag = (match[1] ?? "").toLowerCase();
    const innerHtml = match[2] ?? "";
    if (tag !== "p" && tag !== "h1" && tag !== "h2" && tag !== "h3") continue;
    if (!normalizeWhitespace(stripTags(innerHtml))) continue;
    blocks.push({tag, html: innerHtml});
  }

  return blocks;
}

function splitTextWithUrls(value: string): InlinePart[] {
  const normalized = normalizeWhitespace(stripTags(value));
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

function extractInlineParts(html: string): InlinePart[] {
  const anchorPattern = /<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  const parts: InlinePart[] = [];
  let lastIndex = 0;

  for (const match of html.matchAll(anchorPattern)) {
    const index = match.index ?? 0;
    const href = decodeHtmlEntities(match[1] ?? "").trim();
    const linkHtml = match[2] ?? "";
    const before = html.slice(lastIndex, index);
    parts.push(...splitTextWithUrls(before));

    const linkText = normalizeWhitespace(stripTags(linkHtml));
    if (href) {
      if (linkText) {
        parts.push({text: linkText, href});
        if (!linkText.includes(href)) {
          parts.push({text: ` (${href})`});
        }
      } else {
        parts.push({text: href, href});
      }
    } else if (linkText) {
      parts.push({text: linkText});
    }

    lastIndex = index + match[0].length;
  }

  parts.push(...splitTextWithUrls(html.slice(lastIndex)));

  return parts.filter((part) => part.text.trim().length > 0);
}

function toPortableTextBlock(tag: ParsedHtmlBlock["tag"], html: string): PortableTextBlock | null {
  const parts = extractInlineParts(html);
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

  const style = tag === "h3" ? "h3" : tag === "h2" || tag === "h1" ? "h2" : "normal";
  return {
    _type: "block",
    _key: createKey(),
    style,
    children,
    markDefs,
  };
}

export async function parsePressReleaseDocx(buffer: Buffer): Promise<ParsedPressReleaseDocx> {
  const {value: html} = await mammoth.convertToHtml({buffer});
  const blocks = extractHtmlBlocks(html);

  if (blocks.length === 0) {
    throw new Error("DOCXから本文を抽出できませんでした。");
  }

  const normalizedBlocks = blocks.map((block) => ({
    ...block,
    text: normalizeWhitespace(stripTags(block.html)),
  }));

  const titleIndex = normalizedBlocks.findIndex((block) => block.text && !isEmbargoDateLine(block.text));
  if (titleIndex < 0) {
    throw new Error("DOCXからタイトルを抽出できませんでした。");
  }

  const title = normalizedBlocks[titleIndex].text.slice(0, 200);
  if (!title) {
    throw new Error("DOCXからタイトルを抽出できませんでした。");
  }

  // Drop leading embargo/date heading blocks and the chosen title block.
  const bodySource = blocks.slice(titleIndex + 1);
  const body = bodySource
    .map((block) => toPortableTextBlock(block.tag, block.html))
    .filter((block): block is PortableTextBlock => block !== null);

  return {
    title,
    body,
    plainText: normalizeWhitespace(body.map((block) => block.children.map((child) => child.text).join("")).join("\n\n")),
  };
}
