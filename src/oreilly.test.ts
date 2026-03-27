import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { inspectOReillyHtml } from "./lib/oreilly";

const fixture = readFileSync(
  resolve(process.cwd(), "fixtures/oreilly-sample.html"),
  "utf8",
);
const japanFixture = readFileSync(
  resolve(process.cwd(), "fixtures/oreilly-japan-sample.html"),
  "utf8",
);

test("inspectOReillyHtml extracts title, authors and TOC entries", () => {
  const inspection = inspectOReillyHtml(
    "https://www.oreilly.com/library/view/practical-data-systems/9781492092300/",
    fixture,
  );

  assert.equal(inspection.title, "Practical Data Systems");
  assert.deepEqual(inspection.authors, ["Jane Example", "John Example"]);
  assert.equal(inspection.tocEntries[0], "Chapter 1. Why Data Systems Matter");
  assert.equal(inspection.tocEntries[4], "Part II: Building the Platform");
  assert.equal(inspection.tocEntryCount, 8);
  assert.equal(inspection.chapters.length, 7);
  assert.equal(inspection.chapters[0]?.title, "Chapter 1. Why Data Systems Matter");
  assert.deepEqual(inspection.chapters[0]?.tocEntries, [
    "Chapter 1. Why Data Systems Matter",
  ]);
  assert.equal(inspection.chapters[4]?.partTitle, "Part II: Building the Platform");
  assert.equal(inspection.chapters[4]?.title, "Chapter 5. Observability and Reliability");
});

test("inspectOReillyHtml supports oreilly.co.jp pages with #toc and Japanese headings", () => {
  const inspection = inspectOReillyHtml(
    "https://www.oreilly.co.jp/books/9784814401567/",
    japanFixture,
  );

  assert.equal(inspection.title, "システム思考の世界へ");
  assert.deepEqual(inspection.authors, [
    "Diana Montalion",
    "宮澤 明日香",
    "中西 健人",
    "和智 右桂",
  ]);
  assert.equal(inspection.tocEntries[0], "本書への賛辞");
  assert.equal(inspection.tocEntries[2], "第I部 思考のシステム");
  assert.equal(inspection.tocEntries[3], "1章 システム思考とは何か？");
  assert.ok(inspection.tocEntries.includes("1.1 人は無意識に線形思考へと傾きやすい"));
  assert.equal(inspection.chapters[0]?.title, "本書への賛辞");
  assert.equal(inspection.chapters[1]?.title, "はじめに");
  assert.equal(inspection.chapters[2]?.partTitle, "第I部 思考のシステム");
  assert.equal(inspection.chapters[2]?.title, "1章 システム思考とは何か？");
  assert.ok(
    inspection.chapters[2]?.tocEntries.includes(
      "1.1 人は無意識に線形思考へと傾きやすい",
    ),
  );
});
