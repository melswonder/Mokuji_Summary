import { z } from "zod";

import type { BookSummary, ProviderKind, ProviderStatus } from "../types";

export const summarySchema = z.object({
  summary: z.string().min(1),
  keyTopics: z.array(z.string().min(1)).min(1),
  targetAudience: z.array(z.string().min(1)).min(1),
  confidence: z.enum(["low", "medium", "high"]),
  evidence: z.array(z.string().min(1)).min(1),
  limitations: z.array(z.string().min(1)).min(1),
});

export function unavailableStatus(
  id: ProviderStatus["id"],
  name: string,
  kind: ProviderKind,
  detail: string,
): ProviderStatus {
  return {
    id,
    name,
    kind,
    available: false,
    loggedIn: false,
    detail,
  };
}

export function parseSummaryJson(raw: string): BookSummary {
  const parsed = JSON.parse(extractJsonPayload(raw));
  return summarySchema.parse(parsed);
}

function extractJsonPayload(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed;
  }

  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch?.[1]) {
    return fenceMatch[1].trim();
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  return trimmed;
}
