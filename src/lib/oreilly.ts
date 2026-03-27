import { load } from "cheerio";
import { z } from "zod";

import type { BookChapter, BookInspection } from "./types";

const SUPPORTED_HOST_PATTERN = /(^|\.)oreilly\.(com|co\.jp)$/i;
const TOC_HEADING_PATTERN = /\b(table of contents|contents)\b|目次/i;
const CHAPTER_PATTERN =
  /^(chapter|part|appendix|appendices|foreword|preface|introduction|afterword|conclusion|本書への賛辞|はじめに|まえがき|序文|あとがき|謝辞|索引|付録|第[一二三四五六七八九十百千ivxlcdm]+部|[0-9０-９]+章)/i;
const NUMBERED_CHAPTER_PATTERN =
  /^(\d+(\.\d+)*|chapter\s+\d+|part\s+\d+|appendix\s+[a-z0-9]+|第[一二三四五六七八九十百千ivxlcdm]+部|[0-9０-９]+章|[0-9０-９]+\.[0-9０-９]+)/i;
const JAPANESE_AUTHOR_SPLIT_PATTERN = /、|,|&| and /i;
const JAPANESE_AUTHOR_LINE_PATTERN = /(著|訳)/;
const PART_HEADING_PATTERN = /^(part\s+[ivxlcdm0-9]+|第[一二三四五六七八九十百千ivxlcdm]+部)/i;
const STANDALONE_MATTER_PATTERN =
  /^(foreword|preface|introduction|afterword|conclusion|acknowledg(e)?ments?|本書への賛辞|はじめに|まえがき|序文|訳者あとがき|あとがき|謝辞|索引|付録)/i;
const DECIMAL_SECTION_PATTERN = /^[0-9０-９]+\.[0-9０-９]+/;
const SIMPLE_NUMBERED_CHAPTER_PATTERN =
  /^[0-9０-９]+(?:[.:\-：]\s*[^\d\s].*|\s+[^\d].*)/;

const MAX_FALLBACK_TOC_ENTRIES = 80;

const jsonLdBookSchema = z.object({
  "@type": z.union([z.string(), z.array(z.string())]).optional(),
  name: z.string().optional(),
  author: z
    .union([
      z.string(),
      z.object({ name: z.string().optional() }),
      z.array(z.union([z.string(), z.object({ name: z.string().optional() })])),
    ])
    .optional(),
  tableOfContents: z
    .union([z.string(), z.array(z.string())])
    .optional(),
});

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const value of values.map(normalizeWhitespace)) {
    const key = value.toLowerCase();
    if (!value || seen.has(key)) {
      continue;
    }
    seen.add(key);
    output.push(value);
  }

  return output;
}

function textLooksLikeTocEntry(text: string): boolean {
  if (!text || text.length < 3 || text.length > 180) {
    return false;
  }

  if (TOC_HEADING_PATTERN.test(text)) {
    return false;
  }

  return (
    CHAPTER_PATTERN.test(text) ||
    NUMBERED_CHAPTER_PATTERN.test(text) ||
    /[:\-]/.test(text) ||
    /^第[一二三四五六七八九十百千ivxlcdm]+部/i.test(text) ||
    /^[0-9０-９]+章/.test(text) ||
    /^[0-9０-９]+\.[0-9０-９]+/.test(text) ||
    /\b(api|data|python|javascript|chapter|design|testing|deployment|security)\b/i.test(
      text,
      ) ||
    /システム|思考|設計|実践|学習|フィードバック|モデリング|パターン/.test(text)
  );
}

function collectAuthorNames(rawAuthor: unknown): string[] {
  if (!rawAuthor) {
    return [];
  }

  if (typeof rawAuthor === "string") {
    return rawAuthor
      .replace(/\s*(著|訳)\s*/g, ",")
      .split(JAPANESE_AUTHOR_SPLIT_PATTERN)
      .map(normalizeWhitespace)
      .filter(Boolean);
  }

  if (Array.isArray(rawAuthor)) {
    return rawAuthor.flatMap((item) => collectAuthorNames(item));
  }

  if (
    typeof rawAuthor === "object" &&
    rawAuthor !== null &&
    "name" in rawAuthor &&
    typeof rawAuthor.name === "string"
  ) {
    return [normalizeWhitespace(rawAuthor.name)];
  }

  return [];
}

function parseJsonLd(htmlChunk: string): unknown[] {
  try {
    const parsed = JSON.parse(htmlChunk);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [];
  }
}

function gatherEntriesFromTocHeading($: ReturnType<typeof load>): string[] {
  const entries: string[] = [];

  $("h1, h2, h3, h4, h5, h6").each((_, element) => {
    const heading = normalizeWhitespace($(element).text());
    if (!TOC_HEADING_PATTERN.test(heading)) {
      return;
    }

    let current = $(element).next();
    let steps = 0;

    while (current.length > 0 && steps < 15) {
      if (current.is("h1, h2, h3, h4, h5, h6")) {
        break;
      }

      current.find("li, p, a, pre").each((__, candidate) => {
        const text = normalizeWhitespace($(candidate).text());
        if ($(candidate).is("pre")) {
          entries.push(...extractTocEntriesFromBlock(text));
        } else if (textLooksLikeTocEntry(text)) {
          entries.push(text);
        }
      });

      current = current.next();
      steps += 1;
    }
  });

  return entries;
}

function gatherEntriesFromDedicatedTocId($: ReturnType<typeof load>): string[] {
  const entries: string[] = [];

  const tocRoot = $("#toc");
  if (tocRoot.length === 0) {
    return entries;
  }

  const preText = normalizeWhitespace(tocRoot.find("pre").first().text());
  if (preText) {
    entries.push(...extractTocEntriesFromBlock(tocRoot.find("pre").first().text()));
  }

  tocRoot.find("li, p, div, a, dd, dt").each((_, element) => {
    const text = normalizeWhitespace($(element).text());
    if (textLooksLikeTocEntry(text)) {
      entries.push(text);
    }
  });

  return entries;
}

function gatherEntriesFromTocContainers($: ReturnType<typeof load>): string[] {
  const entries: string[] = [];

  $("[id*='toc'], [class*='toc'], [class*='table-of-contents'], [id*='mokji'], [class*='mokji']")
    .find("li, p, a, div, dd, dt, pre")
    .each((_, element) => {
      const text = normalizeWhitespace($(element).text());
      if ($(element).is("pre")) {
        entries.push(...extractTocEntriesFromBlock($(element).text()));
      } else if (textLooksLikeTocEntry(text)) {
        entries.push(text);
      }
    });

  return entries;
}

function gatherEntriesFromPageLists($: ReturnType<typeof load>): string[] {
  const entries: string[] = [];

  $("li, p").each((_, element) => {
    const text = normalizeWhitespace($(element).text());
    if (textLooksLikeTocEntry(text)) {
      entries.push(text);
    }
  });

  return entries;
}

function extractTocEntriesFromBlock(rawText: string): string[] {
  return rawText
    .split(/\r?\n/)
    .map((line) => normalizeWhitespace(line))
    .filter((line) => textLooksLikeTocEntry(line));
}

function isPartHeading(entry: string): boolean {
  return PART_HEADING_PATTERN.test(entry);
}

function isStandaloneMatter(entry: string): boolean {
  return STANDALONE_MATTER_PATTERN.test(entry);
}

function isChapterHeading(entry: string): boolean {
  if (!entry || DECIMAL_SECTION_PATTERN.test(entry) || isPartHeading(entry)) {
    return false;
  }

  return (
    /^(chapter\s+\d+|appendix\s+[a-z0-9]+)/i.test(entry) ||
    /^[0-9０-９]+章/.test(entry) ||
    SIMPLE_NUMBERED_CHAPTER_PATTERN.test(entry)
  );
}

export function splitTocEntriesIntoChapters(tocEntries: string[]): BookChapter[] {
  const chapters: BookChapter[] = [];
  let currentPartTitle: string | undefined;
  let currentChapter: BookChapter | undefined;

  for (const entry of tocEntries) {
    if (isPartHeading(entry)) {
      currentPartTitle = entry;
      currentChapter = undefined;
      continue;
    }

    if (isStandaloneMatter(entry)) {
      currentPartTitle = undefined;
      currentChapter = {
        id: `chapter-${chapters.length + 1}`,
        title: entry,
        tocEntries: [entry],
      };
      chapters.push(currentChapter);
      continue;
    }

    if (isChapterHeading(entry)) {
      currentChapter = {
        id: `chapter-${chapters.length + 1}`,
        title: entry,
        partTitle: currentPartTitle,
        tocEntries: currentPartTitle ? [currentPartTitle, entry] : [entry],
      };
      chapters.push(currentChapter);
      continue;
    }

    if (!currentChapter) {
      currentChapter = {
        id: `chapter-${chapters.length + 1}`,
        title: currentPartTitle ?? entry,
        partTitle: currentPartTitle,
        tocEntries: currentPartTitle ? [currentPartTitle, entry] : [entry],
      };
      chapters.push(currentChapter);
      continue;
    }

    currentChapter.tocEntries.push(entry);
  }

  return chapters;
}

function gatherAuthorsFromVisibleText($: ReturnType<typeof load>): string[] {
  const candidates: string[] = [];

  $("h1")
    .first()
    .nextAll("p, div")
    .slice(0, 8)
    .each((_, element) => {
      const text = normalizeWhitespace($(element).text());
      if (!JAPANESE_AUTHOR_LINE_PATTERN.test(text)) {
        return;
      }

      const cleaned = text
        .replace(/\s*著\s*/g, ",")
        .replace(/\s*訳\s*/g, ",")
        .replace(/\s*監訳\s*/g, ",")
        .replace(/\s*編著\s*/g, ",");

      candidates.push(...cleaned.split(JAPANESE_AUTHOR_SPLIT_PATTERN));
    });

  return uniqueStrings(
    candidates
      .map((value) => normalizeWhitespace(value))
      .filter((value) => value && !/^(著|訳|監訳|編著)$/.test(value)),
  );
}

function extractBookMetadata($: ReturnType<typeof load>): {
  title: string;
  pageTitle?: string;
  authors: string[];
  tocFromJsonLd: string[];
} {
  const pageTitle = normalizeWhitespace($("title").first().text());
  const metaTitle =
    normalizeWhitespace($('meta[property="og:title"]').attr("content") ?? "") ||
    normalizeWhitespace($('meta[name="twitter:title"]').attr("content") ?? "");

  const h1Title = normalizeWhitespace($("h1").first().text());
  const rawTitle = metaTitle || h1Title || pageTitle;
  const title = rawTitle.replace(/\s*[-|].*$/, "").trim();

  const authors = uniqueStrings([
    ...$('meta[name="author"]')
      .map((_, element) => normalizeWhitespace($(element).attr("content") ?? ""))
      .get(),
    ...$("[rel='author'], .author, [class*='author']")
      .map((_, element) => normalizeWhitespace($(element).text()))
      .get(),
    ...gatherAuthorsFromVisibleText($),
  ]);

  const tocFromJsonLd: string[] = [];

  $('script[type="application/ld+json"]').each((_, element) => {
    const raw = $(element).contents().text();
    for (const candidate of parseJsonLd(raw)) {
      const parsed = jsonLdBookSchema.safeParse(candidate);
      if (!parsed.success) {
        continue;
      }

      const book = parsed.data;
      const typeValue = Array.isArray(book["@type"])
        ? book["@type"].join(" ")
        : (book["@type"] ?? "");
      const looksLikeBook = /book/i.test(typeValue);

      if (!looksLikeBook) {
        continue;
      }

      authors.push(...collectAuthorNames(book.author));

      if (book.tableOfContents) {
        const tocItems = Array.isArray(book.tableOfContents)
          ? book.tableOfContents
          : book.tableOfContents.split(/\n|;/);
        tocFromJsonLd.push(...tocItems.map(normalizeWhitespace).filter(Boolean));
      }
    }
  });

  return {
    title: title || "Untitled O'Reilly book",
    pageTitle: pageTitle || undefined,
    authors: uniqueStrings(authors),
    tocFromJsonLd: uniqueStrings(tocFromJsonLd),
  };
}

export function normalizeAndValidateOReillyUrl(rawUrl: string): URL {
  let url: URL;

  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("有効な URL を指定してください。");
  }

  if (!SUPPORTED_HOST_PATTERN.test(url.hostname)) {
    throw new Error(
      `MVP では oreilly.com / oreilly.co.jp ドメインのみ対応しています。受け取ったホスト: ${url.hostname}`,
    );
  }

  return url;
}

export async function fetchOReillyHtml(rawUrl: string): Promise<string> {
  const url = normalizeAndValidateOReillyUrl(rawUrl);
  const response = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) OReillyBookSummarizer/0.1",
      accept: "text/html,application/xhtml+xml",
    },
  });

  if (!response.ok) {
    throw new Error(`O'Reilly ページの取得に失敗しました: ${response.status}`);
  }

  return await response.text();
}

export function inspectOReillyHtml(rawUrl: string, html: string): BookInspection {
  const url = normalizeAndValidateOReillyUrl(rawUrl);
  const $ = load(html);
  const metadata = extractBookMetadata($);
  const dedicatedTocEntries = uniqueStrings(gatherEntriesFromDedicatedTocId($));

  const candidates = dedicatedTocEntries.length > 0
    ? uniqueStrings([...metadata.tocFromJsonLd, ...dedicatedTocEntries])
    : uniqueStrings([
        ...metadata.tocFromJsonLd,
        ...gatherEntriesFromTocHeading($),
        ...gatherEntriesFromTocContainers($),
        ...gatherEntriesFromPageLists($),
      ]).slice(0, MAX_FALLBACK_TOC_ENTRIES);

  const extractionNotes = [
    dedicatedTocEntries.length > 0
      ? "#toc から目次候補を優先抽出しました。"
      : "#toc は見つからなかったため汎用ルールで探索しました。",
    metadata.tocFromJsonLd.length > 0
      ? "JSON-LD に含まれる目次候補を使用しました。"
      : "JSON-LD からは目次候補を見つけられませんでした。",
    candidates.length > 0
      ? dedicatedTocEntries.length > 0
        ? `${candidates.length} 件の目次候補を #toc から抽出しました。`
        : `${candidates.length} 件の目次候補を抽出しました。`
      : "目次候補を抽出できませんでした。",
  ];

  if (candidates.length === 0) {
    throw new Error(
      "ページから目次らしき構造を見つけられませんでした。DOM の変化に合わせて parser の調整が必要かもしれません。",
    );
  }

  const chapters = splitTocEntriesIntoChapters(candidates);
  if (chapters.length > 0) {
    extractionNotes.push(`${chapters.length} 個の章コンテキストに整理しました。`);
  }

  return {
    sourceUrl: rawUrl,
    normalizedUrl: url.toString(),
    title: metadata.title,
    authors: metadata.authors,
    pageTitle: metadata.pageTitle,
    tocEntries: candidates,
    chapters,
    extractionNotes,
    tocEntryCount: candidates.length,
  };
}

export async function inspectOReillyUrl(rawUrl: string): Promise<BookInspection> {
  const html = await fetchOReillyHtml(rawUrl);
  return inspectOReillyHtml(rawUrl, html);
}
