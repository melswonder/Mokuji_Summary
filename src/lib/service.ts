import { z } from "zod";

import { inspectOReillyUrl } from "./oreilly";
import { getProvider } from "./providers";
import type {
  AnalyzeResult,
  BookInspection,
  ChapterChatMessage,
  ProviderContext,
  ProviderId,
} from "./types";

const inspectRequestSchema = z.object({
  url: z.string().url(),
});

const summarizeRequestSchema = z.object({
  url: z.string().url(),
  provider: z.enum(["claude", "codex", "gemini"]).default("gemini"),
});

const chapterChatRequestSchema = z.object({
  url: z.string().url(),
  provider: z.enum(["claude", "codex", "gemini"]).default("gemini"),
  chapterId: z.string().min(1),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1),
      }),
    )
    .min(1),
});

export function parseInspectRequest(input: unknown): { url: string } {
  return inspectRequestSchema.parse(input);
}

export function parseSummarizeRequest(input: unknown): {
  url: string;
  provider: ProviderId;
} {
  return summarizeRequestSchema.parse(input);
}

export function parseChapterChatRequest(input: unknown): {
  url: string;
  provider: ProviderId;
  chapterId: string;
  messages: ChapterChatMessage[];
} {
  return chapterChatRequestSchema.parse(input);
}

export async function inspectUrl(url: string): Promise<BookInspection> {
  return inspectOReillyUrl(url);
}

export async function analyzeUrl(
  url: string,
  providerId: ProviderId,
  context?: ProviderContext,
): Promise<AnalyzeResult> {
  const inspection = await inspectUrl(url);
  const provider = getProvider(providerId);
  const summary = await provider.summarize(inspection, context);

  return {
    provider: providerId,
    inspection,
    summary,
  };
}

export async function chatWithChapter(
  url: string,
  providerId: ProviderId,
  chapterId: string,
  messages: ChapterChatMessage[],
  context?: ProviderContext,
): Promise<{
  provider: ProviderId;
  inspection: BookInspection;
  chapterId: string;
  answer: string;
}> {
  const inspection = await inspectUrl(url);
  const chapter = inspection.chapters.find((candidate) => candidate.id === chapterId);

  if (!chapter) {
    throw new Error("指定した章が見つかりませんでした。目次を再読み込みしてください。");
  }

  const provider = getProvider(providerId);
  const answer = await provider.chatChapter(inspection, chapter, messages, context);

  return {
    provider: providerId,
    inspection,
    chapterId,
    answer,
  };
}
