export type ProviderKind = "api" | "cli";

export type ProviderId = "claude" | "codex" | "gemini";

export interface BookChapter {
  id: string;
  title: string;
  partTitle?: string;
  tocEntries: string[];
}

export interface BookInspection {
  sourceUrl: string;
  normalizedUrl: string;
  title: string;
  authors: string[];
  pageTitle?: string;
  tocEntries: string[];
  chapters: BookChapter[];
  extractionNotes: string[];
  tocEntryCount: number;
}

export interface BookSummary {
  summary: string;
  keyTopics: string[];
  targetAudience: string[];
  confidence: "low" | "medium" | "high";
  evidence: string[];
  limitations: string[];
}

export interface ProviderStatus {
  id: ProviderId;
  name: string;
  kind: ProviderKind;
  available: boolean;
  loggedIn: boolean;
  detail: string;
  connectedAccount?: string;
}

export interface SessionUser {
  email?: string;
  name?: string;
  picture?: string;
}

export interface GoogleSession {
  accessToken: string;
  refreshToken?: string;
  expiryDate: number;
  scope?: string;
  user?: SessionUser;
}

export interface AppSession {
  id: string;
  createdAt: number;
  oauthState?: string;
  google?: GoogleSession;
}

export interface ApiSettings {
  googleClientId: string;
  googleClientSecret: string;
  googleRedirectUri: string;
  googleCloudProjectId: string;
  geminiModel: string;
}

export interface CliSettings {
  codexCommand: string;
  codexModel: string;
  claudeCommand: string;
  claudeModel: string;
}

export interface AppSettings {
  api: ApiSettings;
  cli: CliSettings;
}

export interface ProviderContext {
  requestOrigin?: string;
  session?: AppSession;
}

export interface ChapterChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ProviderAdapter {
  readonly id: ProviderId;
  readonly name: string;
  readonly kind: ProviderKind;
  getStatus(context?: ProviderContext): Promise<ProviderStatus>;
  summarize(book: BookInspection, context?: ProviderContext): Promise<BookSummary>;
  chatChapter(
    book: BookInspection,
    chapter: BookChapter,
    messages: ChapterChatMessage[],
    context?: ProviderContext,
  ): Promise<string>;
}

export interface AnalyzeResult {
  provider: ProviderId;
  inspection: BookInspection;
  summary: BookSummary;
}
