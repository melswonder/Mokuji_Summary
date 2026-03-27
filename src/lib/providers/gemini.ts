import {
  ensureFreshGoogleAccessToken,
  getGoogleProjectId,
  isGoogleOAuthConfigured,
} from "../google-oauth";
import { buildChapterChatPrompt, buildSummaryPrompt } from "../prompt";
import { getEffectiveSettings } from "../settings";
import { parseSummaryJson, unavailableStatus } from "./shared";
import type { ProviderAdapter, ProviderContext, ProviderStatus } from "../types";

const PROVIDER_NAME = "Gemini API";

export const geminiProvider: ProviderAdapter = {
  id: "gemini",
  name: PROVIDER_NAME,
  kind: "api",

  async getStatus(context?: ProviderContext): Promise<ProviderStatus> {
    const settings = getEffectiveSettings();
    const model = settings.api.geminiModel || "gemini-2.5-flash";

    if (!isGoogleOAuthConfigured()) {
      return unavailableStatus(
        "gemini",
        PROVIDER_NAME,
        "api",
        "Google OAuth 設定が未入力です。設定ボタンから入力してください。",
      );
    }

    if (!getGoogleProjectId()) {
      return unavailableStatus(
        "gemini",
        PROVIDER_NAME,
        "api",
        "Google Cloud Project ID が未入力です。設定ボタンから入力してください。",
      );
    }

    const user = context?.session?.google?.user;
    if (!context?.session?.google) {
      return {
        id: "gemini",
        name: PROVIDER_NAME,
        kind: "api",
        available: true,
        loggedIn: false,
        detail: "Google OAuth で接続してください。",
      };
    }

    return {
      id: "gemini",
      name: PROVIDER_NAME,
      kind: "api",
      available: true,
      loggedIn: true,
      detail: `Google OAuth で接続済み。モデル: ${model}`,
      connectedAccount: user?.email,
    };
  },

  async summarize(book, context) {
    if (!context?.session) {
      throw new Error("Web セッションがありません。Google OAuth ログイン後に再実行してください。");
    }
    if (!context.requestOrigin) {
      throw new Error("Gemini API provider には request origin が必要です。");
    }

    const projectId = getGoogleProjectId();
    const settings = getEffectiveSettings();
    const model = settings.api.geminiModel || "gemini-2.5-flash";
    if (!projectId) {
      throw new Error("`GOOGLE_CLOUD_PROJECT_ID` が未設定です。");
    }

    const accessToken = await ensureFreshGoogleAccessToken(
      context.requestOrigin,
      context.session,
    );

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${accessToken}`,
          "content-type": "application/json",
          "x-goog-user-project": projectId,
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: buildSummaryPrompt(book) }],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json",
          },
        }),
      },
    );

    if (!response.ok) {
      throw new Error(
        `Gemini API 呼び出しに失敗しました: ${response.status} ${await response.text()}`,
      );
    }

    const payload = (await response.json()) as GeminiGenerateContentResponse;
    const text = extractGeminiText(payload);
    if (!text) {
      throw new Error("Gemini API の応答からテキストを取得できませんでした。");
    }

    return parseSummaryJson(text);
  },

  async chatChapter(book, chapter, messages, context) {
    if (!context?.session) {
      throw new Error("Web セッションがありません。Google OAuth ログイン後に再実行してください。");
    }
    if (!context.requestOrigin) {
      throw new Error("Gemini API provider には request origin が必要です。");
    }

    const projectId = getGoogleProjectId();
    const settings = getEffectiveSettings();
    const model = settings.api.geminiModel || "gemini-2.5-flash";
    if (!projectId) {
      throw new Error("`GOOGLE_CLOUD_PROJECT_ID` が未設定です。");
    }

    const accessToken = await ensureFreshGoogleAccessToken(
      context.requestOrigin,
      context.session,
    );

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${accessToken}`,
          "content-type": "application/json",
          "x-goog-user-project": projectId,
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: buildChapterChatPrompt(book, chapter, messages) }],
            },
          ],
          generationConfig: {
            temperature: 0.2,
          },
        }),
      },
    );

    if (!response.ok) {
      throw new Error(
        `Gemini API 呼び出しに失敗しました: ${response.status} ${await response.text()}`,
      );
    }

    const payload = (await response.json()) as GeminiGenerateContentResponse;
    const text = extractGeminiText(payload);
    if (!text) {
      throw new Error("Gemini API の応答からテキストを取得できませんでした。");
    }

    return text;
  },
};

interface GeminiGenerateContentResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
}

function extractGeminiText(payload: GeminiGenerateContentResponse): string | undefined {
  for (const candidate of payload.candidates ?? []) {
    for (const part of candidate.content?.parts ?? []) {
      if (typeof part.text === "string" && part.text.trim()) {
        return part.text.trim();
      }
    }
  }

  return undefined;
}
