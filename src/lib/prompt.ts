import type { BookChapter, BookInspection, ChapterChatMessage } from "./types";

export const SUMMARY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "summary",
    "keyTopics",
    "targetAudience",
    "confidence",
    "evidence",
    "limitations",
  ],
  properties: {
    summary: {
      type: "string",
      description:
        "本がどのような内容を扱うかを日本語で2〜4文でまとめた要約。",
    },
    keyTopics: {
      type: "array",
      items: { type: "string" },
      minItems: 3,
      maxItems: 8,
    },
    targetAudience: {
      type: "array",
      items: { type: "string" },
      minItems: 1,
      maxItems: 5,
    },
    confidence: {
      type: "string",
      enum: ["low", "medium", "high"],
    },
    evidence: {
      type: "array",
      items: { type: "string" },
      minItems: 2,
      maxItems: 8,
    },
    limitations: {
      type: "array",
      items: { type: "string" },
      minItems: 1,
      maxItems: 5,
    },
  },
} as const;

export function buildSummaryPrompt(book: BookInspection): string {
  const tocBlock = book.tocEntries.map((entry, index) => `${index + 1}. ${entry}`).join("\n");
  const authorBlock = book.authors.length > 0 ? book.authors.join(", ") : "不明";

  return [
    "あなたは技術書の内容を、与えられた書誌情報と目次だけから推定して要約するアシスタントです。",
    "推定できることだけを述べ、目次から読み取れない内容を断定しないでください。",
    "出力は必ず JSON のみで返してください。",
    "",
    `書名: ${book.title}`,
    `著者: ${authorBlock}`,
    `URL: ${book.normalizedUrl}`,
    "",
    "抽出した目次:",
    tocBlock,
    "",
    "要約方針:",
    "- 日本語で書く",
    "- 目次から読み取れる主要テーマをまとめる",
    "- どの読者に向いていそうかを述べる",
    "- 不確実な点は limitations に書く",
    "- evidence には目次から直接言える根拠を書く",
  ].join("\n");
}

export function buildChapterChatPrompt(
  book: BookInspection,
  chapter: BookChapter,
  messages: ChapterChatMessage[],
): string {
  const authorBlock = book.authors.length > 0 ? book.authors.join(", ") : "不明";
  const chapterBlock = chapter.tocEntries
    .map((entry, index) => `${index + 1}. ${entry}`)
    .join("\n");
  const historyBlock = messages
    .slice(-10)
    .map((message) => `${message.role === "user" ? "user" : "assistant"}: ${message.content}`)
    .join("\n");

  return [
    "あなたは技術書の章構成だけを手がかりに、読者の質問へ日本語で答えるアシスタントです。",
    "回答は、与えられた書誌情報と選択中の章の目次から推定できる範囲に限定してください。",
    "目次から読み取れないことは断定せず、『この目次だけでは判断できない』と明示してください。",
    "必要なら箇条書きを使っても構いませんが、冗長にしないでください。",
    "",
    `書名: ${book.title}`,
    `著者: ${authorBlock}`,
    `URL: ${book.normalizedUrl}`,
    chapter.partTitle ? `属する部: ${chapter.partTitle}` : "",
    `選択中の章: ${chapter.title}`,
    "",
    "この章の目次:",
    chapterBlock,
    "",
    "会話履歴:",
    historyBlock,
    "",
    "直近の user の質問に答えてください。",
  ]
    .filter(Boolean)
    .join("\n");
}
