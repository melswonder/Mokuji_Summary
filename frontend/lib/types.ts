export type ProviderStatus = {
  id: string;
  name: string;
  kind: string;
  available: boolean;
  logged_in: boolean;
  detail: string;
  connected_account?: string | null;
};

export type SessionState = {
  id?: string;
  google_connected: boolean;
  user?: {
    email?: string | null;
    name?: string | null;
    picture?: string | null;
  } | null;
};

export type Chapter = {
  id: string;
  chapter_key: string;
  sort_order: number;
  title: string;
  part_title?: string | null;
  toc_entries: string[];
  is_archived: boolean;
};

export type Summary = {
  provider_id: string;
  summary: string;
  key_topics: string[];
  target_audience: string[];
  confidence: string;
  evidence: string[];
  limitations: string[];
  updated_at?: string | null;
};

export type Book = {
  id: string;
  source_url: string;
  normalized_url: string;
  source_site: string;
  title: string;
  cover_image_url?: string | null;
  authors: string[];
  page_title?: string | null;
  extraction_notes: string[];
  toc_entries: string[];
  toc_entry_count: number;
  chapters: Chapter[];
  summaries: Summary[];
};

export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

export type Thread = {
  id: string;
  provider_id: string;
  chapter_id: string;
  messages: Message[];
};

export type SettingsState = {
  api: {
    google_client_id: string;
    google_client_secret: string;
    google_redirect_uri: string;
    google_cloud_project_id: string;
    gemini_model: string;
  };
  cli: {
    codex_command: string;
    codex_model: string;
    claude_command: string;
    claude_model: string;
  };
};
