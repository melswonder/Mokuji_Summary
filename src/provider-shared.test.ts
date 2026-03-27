import test from "node:test";
import assert from "node:assert/strict";

import { parseSummaryJson } from "./lib/providers/shared";

test("parseSummaryJson handles fenced JSON", () => {
  const summary = parseSummaryJson(`
  \`\`\`json
  {
    "summary": "目次から見て、データ基盤の設計と運用を扱う本です。",
    "keyTopics": ["設計", "運用", "テスト"],
    "targetAudience": ["データエンジニア"],
    "confidence": "medium",
    "evidence": ["Chapter 1. Introduction", "Chapter 3. Testing and Deployment"],
    "limitations": ["目次しか見ていません"]
  }
  \`\`\`
  `);

  assert.equal(summary.confidence, "medium");
  assert.equal(summary.keyTopics[0], "設計");
});
