"use client";

import { useEffect, useState } from "react";
import { LogOut, Settings2 } from "lucide-react";

import { disconnectGoogle, getApiBase, saveSettings } from "@/lib/api";
import type { ProviderStatus, SessionState, SettingsState } from "@/lib/types";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  providers: ProviderStatus[];
  session: SessionState | null;
  settings: SettingsState | null;
  onRefresh: () => Promise<void>;
};

export function SettingsDrawer({ isOpen, onClose, providers, session, settings, onRefresh }: Props) {
  const [activeTab, setActiveTab] = useState<"api" | "cli">("api");
  const [message, setMessage] = useState("設定を読み込み中です。");
  const [draft, setDraft] = useState<SettingsState | null>(settings);

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  if (!isOpen) {
    return null;
  }

  const apiBase = getApiBase();
  const googleHref =
    typeof window === "undefined"
      ? "#"
      : `${apiBase}/api/v1/auth/google/start?redirect_path=${encodeURIComponent(window.location.href)}`;

  async function handleSave() {
    if (!draft) {
      return;
    }
    setMessage("設定を保存しています...");
    try {
      await saveSettings({
        api: {
          google_client_id: draft.api.google_client_id,
          google_client_secret: draft.api.google_client_secret,
          google_redirect_uri: draft.api.google_redirect_uri,
          google_cloud_project_id: draft.api.google_cloud_project_id,
          gemini_model: draft.api.gemini_model,
        },
        cli: draft.cli,
      });
      setMessage("設定を保存しました。");
      await onRefresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function handleDisconnect() {
    setMessage("Google 連携を解除しています...");
    try {
      await disconnectGoogle();
      await onRefresh();
      setMessage("Google 連携を解除しました。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="設定を閉じる"
        className="absolute inset-0 bg-black/20 backdrop-blur-sm"
        onClick={onClose}
      />
      <aside className="absolute right-0 top-0 h-full w-full max-w-xl border-l border-line bg-panel p-6 shadow-panel">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-accent">Integrations</p>
            <h2 className="mt-2 text-3xl">設定</h2>
          </div>
          <button
            type="button"
            className="rounded-full border border-line px-4 py-2 text-sm"
            onClick={onClose}
          >
            閉じる
          </button>
        </div>

        <div className="mt-6 flex gap-2 rounded-full bg-sand p-1">
          <button
            type="button"
            className={`rounded-full px-4 py-2 text-sm ${activeTab === "api" ? "bg-white" : ""}`}
            onClick={() => setActiveTab("api")}
          >
            API
          </button>
          <button
            type="button"
            className={`rounded-full px-4 py-2 text-sm ${activeTab === "cli" ? "bg-white" : ""}`}
            onClick={() => setActiveTab("cli")}
          >
            CLI
          </button>
        </div>

        <p className="mt-4 text-sm text-neutral-600">{message}</p>

        {activeTab === "api" ? (
          <div className="mt-6 space-y-5">
            <label className="block space-y-2">
              <span className="text-sm font-medium">Google Client ID</span>
              <input
                className="w-full rounded-2xl border border-line bg-white px-4 py-3"
                value={draft?.api.google_client_id ?? ""}
                onChange={(event) =>
                  setDraft((current) =>
                    current
                      ? {
                          ...current,
                          api: { ...current.api, google_client_id: event.target.value },
                        }
                      : current,
                  )
                }
              />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium">Redirect URI</span>
              <input
                className="w-full rounded-2xl border border-line bg-white px-4 py-3"
                value={draft?.api.google_redirect_uri ?? ""}
                onChange={(event) =>
                  setDraft((current) =>
                    current
                      ? {
                          ...current,
                          api: { ...current.api, google_redirect_uri: event.target.value },
                        }
                      : current,
                  )
                }
              />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium">Google Client Secret</span>
              <input
                type="password"
                className="w-full rounded-2xl border border-line bg-white px-4 py-3"
                value={draft?.api.google_client_secret ?? ""}
                onChange={(event) =>
                  setDraft((current) =>
                    current
                      ? {
                          ...current,
                          api: { ...current.api, google_client_secret: event.target.value },
                        }
                      : current,
                  )
                }
              />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium">Google Cloud Project ID</span>
              <input
                className="w-full rounded-2xl border border-line bg-white px-4 py-3"
                value={draft?.api.google_cloud_project_id ?? ""}
                onChange={(event) =>
                  setDraft((current) =>
                    current
                      ? {
                          ...current,
                          api: { ...current.api, google_cloud_project_id: event.target.value },
                        }
                      : current,
                  )
                }
              />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium">Gemini Model</span>
              <input
                className="w-full rounded-2xl border border-line bg-white px-4 py-3"
                value={draft?.api.gemini_model ?? ""}
                onChange={(event) =>
                  setDraft((current) =>
                    current
                      ? {
                          ...current,
                          api: { ...current.api, gemini_model: event.target.value },
                        }
                      : current,
                  )
                }
              />
            </label>

            <div className="rounded-3xl border border-line bg-white p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium">Google OAuth</p>
                  <p className="text-sm text-neutral-600">
                    {session?.google_connected
                      ? `${session.user?.name || session.user?.email || "接続済み"}`
                      : "まだ接続されていません。"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <a
                    className="inline-flex items-center rounded-full bg-accent px-4 py-2 text-sm font-medium text-white"
                    href={googleHref}
                  >
                    <Settings2 className="mr-2 h-4 w-4" />
                    Google で接続
                  </a>
                  <button
                    type="button"
                    className="inline-flex items-center rounded-full border border-line px-4 py-2 text-sm"
                    onClick={handleDisconnect}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    解除
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-6 space-y-5">
            {[
              ["Codex Command", "codex_command"],
              ["Codex Model", "codex_model"],
              ["Claude Command", "claude_command"],
              ["Claude Model", "claude_model"],
            ].map(([label, key]) => (
              <label className="block space-y-2" key={key}>
                <span className="text-sm font-medium">{label}</span>
                <input
                  className="w-full rounded-2xl border border-line bg-white px-4 py-3"
                  value={draft?.cli[key as keyof SettingsState["cli"]] ?? ""}
                  onChange={(event) =>
                    setDraft((current) =>
                      current
                        ? {
                            ...current,
                            cli: { ...current.cli, [key]: event.target.value },
                          }
                        : current,
                    )
                  }
                />
              </label>
            ))}
          </div>
        )}

        <div className="mt-8 rounded-3xl border border-line bg-white p-4">
          <p className="font-medium">Provider 状態</p>
          <div className="mt-3 space-y-3">
            {providers.map((provider) => (
              <div className="rounded-2xl border border-line px-4 py-3" key={provider.id}>
                <div className="flex items-center justify-between gap-4">
                  <strong>{provider.name}</strong>
                  <span className="text-xs uppercase tracking-[0.2em] text-neutral-500">
                    {provider.logged_in ? "ready" : "login required"}
                  </span>
                </div>
                <p className="mt-1 text-sm text-neutral-600">{provider.detail}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <button type="button" className="rounded-full bg-accent px-5 py-3 text-white" onClick={handleSave}>
            保存
          </button>
          <button type="button" className="rounded-full border border-line px-5 py-3" onClick={onClose}>
            キャンセル
          </button>
        </div>
      </aside>
    </div>
  );
}
