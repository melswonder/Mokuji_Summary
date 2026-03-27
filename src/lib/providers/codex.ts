import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { ProviderAdapter, ProviderStatus } from "../types";
import {
  buildChapterChatPrompt,
  buildSummaryPrompt,
  SUMMARY_SCHEMA,
} from "../prompt";
import { runCommand } from "../process";
import { getEffectiveSettings } from "../settings";
import { parseSummaryJson, unavailableStatus } from "./shared";

const PROVIDER_NAME = "Codex";

export const codexProvider: ProviderAdapter = {
  id: "codex",
  name: PROVIDER_NAME,
  kind: "cli",

  async getStatus(): Promise<ProviderStatus> {
    const settings = getEffectiveSettings();
    const command = settings.cli.codexCommand || "codex";

    try {
      const result = await runCommand(command, ["login", "status"], {
        timeoutMs: 10_000,
      });
      const text = `${result.stdout}\n${result.stderr}`;
      const loggedIn = /logged in/i.test(text);

      return {
        id: "codex",
        name: PROVIDER_NAME,
        kind: "cli",
        available: true,
        loggedIn,
        detail: loggedIn
          ? normalizeStatusDetail(text)
          : `未ログイン。\`${command} login\` が必要です。`,
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return unavailableStatus(
          "codex",
          PROVIDER_NAME,
          "cli",
          `\`${command}\` CLI が見つかりません。`,
        );
      }

      return unavailableStatus(
        "codex",
        PROVIDER_NAME,
        "cli",
        `状態確認に失敗しました: ${(error as Error).message}`,
      );
    }
  },

  async summarize(book) {
    const settings = getEffectiveSettings();
    const command = settings.cli.codexCommand || "codex";
    const model = settings.cli.codexModel;
    const status = await this.getStatus();
    if (!status.available || !status.loggedIn) {
      throw new Error(status.detail);
    }

    const tempDir = await mkdtemp(join(tmpdir(), "oreilly-codex-"));
    const schemaPath = join(tempDir, "summary-schema.json");
    const outputPath = join(tempDir, "summary-output.json");

    try {
      await writeFile(schemaPath, JSON.stringify(SUMMARY_SCHEMA, null, 2), "utf8");

      await runCommand(
        command,
        [
          "-a",
          "never",
          "exec",
          ...(model ? ["-m", model] : []),
          "--skip-git-repo-check",
          "--ephemeral",
          "--sandbox",
          "read-only",
          "--output-schema",
          schemaPath,
          "--output-last-message",
          outputPath,
          buildSummaryPrompt(book),
        ],
        {
          timeoutMs: 180_000,
        },
      );

      const output = await readFile(outputPath, "utf8");
      return parseSummaryJson(output.trim());
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  },

  async chatChapter(book, chapter, messages) {
    const settings = getEffectiveSettings();
    const command = settings.cli.codexCommand || "codex";
    const model = settings.cli.codexModel;
    const status = await this.getStatus();
    if (!status.available || !status.loggedIn) {
      throw new Error(status.detail);
    }

    const tempDir = await mkdtemp(join(tmpdir(), "oreilly-codex-chat-"));
    const outputPath = join(tempDir, "chat-output.txt");

    try {
      await runCommand(
        command,
        [
          "-a",
          "never",
          "exec",
          ...(model ? ["-m", model] : []),
          "--skip-git-repo-check",
          "--ephemeral",
          "--sandbox",
          "read-only",
          "--output-last-message",
          outputPath,
          buildChapterChatPrompt(book, chapter, messages),
        ],
        {
          timeoutMs: 180_000,
        },
      );

      const output = await readFile(outputPath, "utf8");
      return output.trim();
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  },
};

function normalizeStatusDetail(text: string): string {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("WARNING:"))
    .join(" ");
}
