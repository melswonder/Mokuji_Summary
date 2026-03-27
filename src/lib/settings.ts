import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { z } from "zod";

import type { AppSettings } from "./types";

type AppSettingsUpdate = {
  api?: Partial<AppSettings["api"]>;
  cli?: Partial<AppSettings["cli"]>;
};

const settingsPath = resolve(process.cwd(), "data", "app-settings.json");

const appSettingsSchema = z.object({
  api: z.object({
    googleClientId: z.string().default(""),
    googleClientSecret: z.string().default(""),
    googleRedirectUri: z.string().default(""),
    googleCloudProjectId: z.string().default(""),
    geminiModel: z.string().default(""),
  }),
  cli: z.object({
    codexCommand: z.string().default(""),
    codexModel: z.string().default(""),
    claudeCommand: z.string().default(""),
    claudeModel: z.string().default(""),
  }),
});

const appSettingsUpdateSchema = z.object({
  api: appSettingsSchema.shape.api.partial().optional(),
  cli: appSettingsSchema.shape.cli.partial().optional(),
});

export function getEffectiveSettings(): AppSettings {
  const stored = readStoredSettings();
  const envDefaults = getEnvBackedSettings();

  return {
    api: {
      googleClientId: stored.api.googleClientId || envDefaults.api.googleClientId,
      googleClientSecret:
        stored.api.googleClientSecret || envDefaults.api.googleClientSecret,
      googleRedirectUri:
        stored.api.googleRedirectUri || envDefaults.api.googleRedirectUri,
      googleCloudProjectId:
        stored.api.googleCloudProjectId || envDefaults.api.googleCloudProjectId,
      geminiModel: stored.api.geminiModel || envDefaults.api.geminiModel,
    },
    cli: {
      codexCommand: stored.cli.codexCommand || envDefaults.cli.codexCommand,
      codexModel: stored.cli.codexModel || envDefaults.cli.codexModel,
      claudeCommand: stored.cli.claudeCommand || envDefaults.cli.claudeCommand,
      claudeModel: stored.cli.claudeModel || envDefaults.cli.claudeModel,
    },
  };
}

export function getStoredSettings(): AppSettings {
  return readStoredSettings();
}

export function parseSettingsUpdate(input: unknown): AppSettingsUpdate {
  return appSettingsUpdateSchema.parse(input);
}

export async function saveSettings(update: AppSettingsUpdate): Promise<AppSettings> {
  const current = readStoredSettings();
  const merged = appSettingsSchema.parse({
    api: {
      ...current.api,
      ...(update.api ?? {}),
    },
    cli: {
      ...current.cli,
      ...(update.cli ?? {}),
    },
  });

  await mkdir(dirname(settingsPath), { recursive: true });
  await writeFile(settingsPath, JSON.stringify(merged, null, 2), "utf8");
  return merged;
}

function readStoredSettings(): AppSettings {
  if (!existsSync(settingsPath)) {
    return emptySettings();
  }

  try {
    const raw = readFileSync(settingsPath, "utf8");
    return appSettingsSchema.parse(JSON.parse(raw));
  } catch {
    return emptySettings();
  }
}

function getEnvBackedSettings(): AppSettings {
  return {
    api: {
      googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
      googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      googleRedirectUri: process.env.GOOGLE_REDIRECT_URI ?? "",
      googleCloudProjectId: process.env.GOOGLE_CLOUD_PROJECT_ID ?? "",
      geminiModel: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
    },
    cli: {
      codexCommand: process.env.CODEX_COMMAND ?? "codex",
      codexModel: process.env.CODEX_MODEL ?? "",
      claudeCommand: process.env.CLAUDE_COMMAND ?? "claude",
      claudeModel: process.env.CLAUDE_MODEL ?? "sonnet",
    },
  };
}

function emptySettings(): AppSettings {
  return {
    api: {
      googleClientId: "",
      googleClientSecret: "",
      googleRedirectUri: "",
      googleCloudProjectId: "",
      geminiModel: "",
    },
    cli: {
      codexCommand: "",
      codexModel: "",
      claudeCommand: "",
      claudeModel: "",
    },
  };
}
