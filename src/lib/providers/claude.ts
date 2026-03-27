import type { ProviderAdapter, ProviderStatus } from "../types";
import {
  buildChapterChatPrompt,
  buildSummaryPrompt,
  SUMMARY_SCHEMA,
} from "../prompt";
import { CommandFailure, runCommand } from "../process";
import { getEffectiveSettings } from "../settings";
import { parseSummaryJson, unavailableStatus } from "./shared";

const AUTH_STATUS_NAME = "Claude";

export const claudeProvider: ProviderAdapter = {
  id: "claude",
  name: AUTH_STATUS_NAME,
  kind: "cli",

  async getStatus(): Promise<ProviderStatus> {
    const settings = getEffectiveSettings();
    const command = settings.cli.claudeCommand || "claude";

    try {
      const result = await runCommand(command, ["auth", "status"], {
        timeoutMs: 10_000,
      });
      const payload = JSON.parse(result.stdout) as {
        loggedIn?: boolean;
        authMethod?: string;
      };

      return {
        id: "claude",
        name: AUTH_STATUS_NAME,
        kind: "cli",
        available: true,
        loggedIn: Boolean(payload.loggedIn),
        detail: payload.loggedIn
          ? `ログイン済み (${payload.authMethod ?? "unknown"})`
          : `未ログイン。\`${command} auth login\` が必要です。`,
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return unavailableStatus(
          "claude",
          AUTH_STATUS_NAME,
          "cli",
          `\`${command}\` CLI が見つかりません。`,
        );
      }

      if (error instanceof CommandFailure) {
        const stdout = error.stdout.trim();
        if (stdout.startsWith("{")) {
          const payload = JSON.parse(stdout) as { loggedIn?: boolean };
          return {
            id: "claude",
            name: AUTH_STATUS_NAME,
            kind: "cli",
            available: true,
            loggedIn: Boolean(payload.loggedIn),
            detail: payload.loggedIn
              ? "ログイン済み"
              : `未ログイン。\`${command} auth login\` が必要です。`,
          };
        }
      }

      return unavailableStatus(
        "claude",
        AUTH_STATUS_NAME,
        "cli",
        `状態確認に失敗しました: ${(error as Error).message}`,
      );
    }
  },

  async summarize(book) {
    const settings = getEffectiveSettings();
    const command = settings.cli.claudeCommand || "claude";
    const model = settings.cli.claudeModel || "sonnet";
    const status = await this.getStatus();
    if (!status.available || !status.loggedIn) {
      throw new Error(status.detail);
    }

    const result = await runCommand(
      command,
      [
        "-p",
        "--json-schema",
        JSON.stringify(SUMMARY_SCHEMA),
        "--output-format",
        "text",
        "--model",
        model,
        buildSummaryPrompt(book),
      ],
      {
        timeoutMs: 120_000,
      },
    );

    return parseSummaryJson(result.stdout.trim());
  },

  async chatChapter(book, chapter, messages) {
    const settings = getEffectiveSettings();
    const command = settings.cli.claudeCommand || "claude";
    const model = settings.cli.claudeModel || "sonnet";
    const status = await this.getStatus();
    if (!status.available || !status.loggedIn) {
      throw new Error(status.detail);
    }

    const result = await runCommand(
      command,
      [
        "-p",
        "--output-format",
        "text",
        "--model",
        model,
        buildChapterChatPrompt(book, chapter, messages),
      ],
      {
        timeoutMs: 120_000,
      },
    );

    return result.stdout.trim();
  },
};
