"use client";

import { FormEvent, useEffect, useState } from "react";

type Provider = {
  id: string;
  name: string;
  kind: "api" | "cli";
  available: boolean;
  loggedIn: boolean;
  detail: string;
  connectedAccount?: string;
};

type SessionState = {
  id?: string;
  googleConnected: boolean;
  user?: {
    email?: string;
    name?: string;
    picture?: string;
  };
};

type SettingsState = {
  api: {
    googleClientId: string;
    googleClientSecret: string;
    googleRedirectUri: string;
    googleCloudProjectId: string;
    geminiModel: string;
  };
  cli: {
    codexCommand: string;
    codexModel: string;
    claudeCommand: string;
    claudeModel: string;
  };
};

type Chapter = {
  id: string;
  title: string;
  partTitle?: string;
  tocEntries: string[];
};

type Inspection = {
  sourceUrl: string;
  normalizedUrl: string;
  title: string;
  authors: string[];
  extractionNotes: string[];
  tocEntries: string[];
  chapters: Chapter[];
};

type Summary = {
  summary: string;
  keyTopics: string[];
  targetAudience: string[];
  confidence: string;
  evidence: string[];
  limitations: string[];
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const EMPTY_SETTINGS: SettingsState = {
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

const EMPTY_CHAT_MESSAGE =
  "左の章を選ぶと、その章の目次だけを前提に質問できます。";

export function AppShell() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [session, setSession] = useState<SessionState | null>(null);
  const [googleConfigured, setGoogleConfigured] = useState(false);
  const [settings, setSettings] = useState<SettingsState>(EMPTY_SETTINGS);
  const [url, setUrl] = useState("");
  const [provider, setProvider] = useState("gemini");
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [summaryProvider, setSummaryProvider] = useState("");
  const [selectedChapterId, setSelectedChapterId] = useState("");
  const [chapterChats, setChapterChats] = useState<Record<string, ChatMessage[]>>({});
  const [chatInput, setChatInput] = useState("");
  const [inspectionMessage, setInspectionMessage] = useState("まだ実行していません。");
  const [summaryMessage, setSummaryMessage] = useState("まだ実行していません。");
  const [chatMessage, setChatMessage] = useState(EMPTY_CHAT_MESSAGE);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState("保存先を確認しています...");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"api" | "cli">("api");

  const selectedChapter =
    inspection?.chapters.find((chapter) => chapter.id === selectedChapterId) ?? null;
  const selectedChatHistory = selectedChapter
    ? (chapterChats[selectedChapter.id] ?? [])
    : [];

  useEffect(() => {
    void Promise.all([loadSession(), loadProviders()]);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    if (params.get("auth") === "google-success") {
      setSettingsMessage("Google OAuth の接続が完了しました。");
      setIsSettingsOpen(true);
      void Promise.all([loadSession(), loadProviders(), loadSettings()]);
    }
  }, []);

  useEffect(() => {
    if (!inspection?.chapters.length) {
      setSelectedChapterId("");
      return;
    }

    setSelectedChapterId((current) =>
      inspection.chapters.some((chapter) => chapter.id === current)
        ? current
        : inspection.chapters[0]?.id ?? "",
    );
  }, [inspection]);

  async function loadSession() {
    const data = await getJson<{
      session: SessionState;
      oauth: { googleConfigured: boolean };
    }>("/api/session");
    setSession(data.session);
    setGoogleConfigured(data.oauth.googleConfigured);
  }

  async function loadProviders() {
    const data = await getJson<{ providers: Provider[] }>("/api/providers");
    setProviders(data.providers);
  }

  async function loadSettings() {
    const data = await getJson<{
      settings: SettingsState;
    }>("/api/settings");
    setSettings(data.settings);
    setSettingsMessage("設定を読み込みました。");
  }

  async function handleInspect() {
    if (!url.trim()) {
      return;
    }

    setInspection(null);
    setSummary(null);
    setChapterChats({});
    setChatInput("");
    setInspectionMessage("目次を抽出しています...");
    setSummaryMessage("まだ実行していません。");
    setChatMessage("章一覧を組み立てています...");

    try {
      const data = await postJson<{ inspection: Inspection }>("/api/inspect", { url });
      setInspection(data.inspection);
      setInspectionMessage("");
      setChatMessage(
        data.inspection.chapters.length > 0
          ? EMPTY_CHAT_MESSAGE
          : "目次は取れましたが、章単位には整理できませんでした。",
      );
    } catch (error) {
      const message = getErrorMessage(error);
      setInspectionMessage(message);
      setChatMessage(message);
    }
  }

  async function handleSummarize(event: FormEvent) {
    event.preventDefault();
    setInspection(null);
    setSummary(null);
    setChapterChats({});
    setChatInput("");
    setInspectionMessage("抽出と要約を実行しています...");
    setSummaryMessage("要約を生成しています...");
    setChatMessage("章一覧を組み立てています...");

    try {
      const data = await postJson<{
        provider: string;
        inspection: Inspection;
        summary: Summary;
      }>("/api/summarize", { url, provider });
      setInspection(data.inspection);
      setSummary(data.summary);
      setSummaryProvider(data.provider);
      setInspectionMessage("");
      setSummaryMessage("");
      setChatMessage(
        data.inspection.chapters.length > 0
          ? EMPTY_CHAT_MESSAGE
          : "目次は取れましたが、章単位には整理できませんでした。",
      );
    } catch (error) {
      const message = getErrorMessage(error);
      setInspectionMessage(message);
      setSummaryMessage(message);
      setChatMessage(message);
    }
  }

  async function handleChapterChat(event: FormEvent) {
    event.preventDefault();
    if (!inspection || !selectedChapter || !chatInput.trim() || isChatLoading) {
      return;
    }

    const chapterId = selectedChapter.id;
    const userMessage: ChatMessage = {
      role: "user",
      content: chatInput.trim(),
    };
    const nextMessages = [...(chapterChats[chapterId] ?? []), userMessage];

    setChapterChats((current) => ({
      ...current,
      [chapterId]: nextMessages,
    }));
    setChatInput("");
    setIsChatLoading(true);
    setChatMessage(`「${selectedChapter.title}」について回答を生成しています...`);

    try {
      const data = await postJson<{
        provider: string;
        chapterId: string;
        answer: string;
      }>("/api/chat", {
        url: inspection.sourceUrl || url,
        provider,
        chapterId,
        messages: nextMessages,
      });

      setChapterChats((current) => ({
        ...current,
        [data.chapterId]: [
          ...(current[data.chapterId] ?? nextMessages),
          { role: "assistant", content: data.answer },
        ],
      }));
      setChatMessage("");
    } catch (error) {
      setChatMessage(getErrorMessage(error));
    } finally {
      setIsChatLoading(false);
    }
  }

  async function handleSaveApiSettings(event: FormEvent) {
    event.preventDefault();
    setSettingsMessage("API 設定を保存しています...");

    try {
      const data = await postJson<{ settings: SettingsState }>("/api/settings", {
        api: settings.api,
      });
      setSettings(data.settings);
      setSettingsMessage("API 設定を保存しました。");
      await Promise.all([loadSession(), loadProviders()]);
    } catch (error) {
      setSettingsMessage(getErrorMessage(error));
    }
  }

  async function handleSaveCliSettings(event: FormEvent) {
    event.preventDefault();
    setSettingsMessage("CLI 設定を保存しています...");

    try {
      const data = await postJson<{ settings: SettingsState }>("/api/settings", {
        cli: settings.cli,
      });
      setSettings(data.settings);
      setSettingsMessage("CLI 設定を保存しました。");
      await Promise.all([loadProviders(), loadSession()]);
    } catch (error) {
      setSettingsMessage(getErrorMessage(error));
    }
  }

  async function handleDisconnectGoogle() {
    try {
      await postJson("/api/auth/google/disconnect", {});
      await Promise.all([loadSession(), loadProviders(), loadSettings()]);
    } catch (error) {
      setSettingsMessage(getErrorMessage(error));
    }
  }

  function openSettings(tab: "api" | "cli" = "api") {
    setActiveTab(tab);
    setIsSettingsOpen(true);
    void loadSettings();
  }

  function renderSessionCard() {
    if (!googleConfigured) {
      return (
        <>
          <p>Google OAuth 設定がまだ入っていません。</p>
          <p>
            <strong>設定</strong> から API タブを開いて必要項目を入力してください。
          </p>
        </>
      );
    }

    if (!session?.googleConnected) {
      return (
        <>
          <p>まだ Google と接続していません。</p>
          <p>
            Gemini API を使う場合は <strong>設定</strong> の API タブから
            <strong> Google で接続 </strong>
            を押してください。
          </p>
        </>
      );
    }

    return (
      <div className="provider">
        <div className="provider-row">
          <strong>{session.user?.name || session.user?.email || "Google user"}</strong>
          <span className="badge ok">connected</span>
        </div>
        <p>{session.user?.email || ""}</p>
      </div>
    );
  }

  const apiProviders = providers.filter((item) => item.kind === "api");
  const cliProviders = providers.filter((item) => item.kind === "cli");

  return (
    <>
      <main className="page">
        <section className="hero">
          <div className="hero-head">
            <div>
              <p className="eyebrow">Next.js App</p>
              <h1>O&apos;Reilly の目次を章ごとに分けて、その章について質問する</h1>
              <p className="lede">
                URL を入れると O&apos;Reilly のページから目次を抽出し、章ごとに整理します。
                左の章を選ぶと、Google OAuth で接続した <code>Gemini API</code> か、
                サーバー側の <code>codex</code> / <code>claude</code> CLI にその章の
                文脈だけを渡してチャットできます。
              </p>
            </div>
            <div className="hero-actions">
              <button className="secondary" type="button" onClick={() => openSettings("api")}>
                設定
              </button>
            </div>
          </div>
        </section>

        <section className="grid">
          <article className="card">
            <div className="section-head">
              <h2>Google OAuth</h2>
              <button className="link-button" type="button" onClick={() => openSettings("api")}>
                設定で接続
              </button>
            </div>
            <div className="stack muted">{renderSessionCard()}</div>
            <div className="actions top-gap">
              <button className="secondary" type="button" onClick={handleDisconnectGoogle}>
                Google 連携を解除
              </button>
            </div>
          </article>

          <article className="card">
            <div className="section-head">
              <h2>Provider 状態</h2>
              <button className="ghost" type="button" onClick={() => void loadProviders()}>
                再読み込み
              </button>
            </div>
            <div className="stack">{renderProviderCards(providers)}</div>
          </article>
        </section>

        <section className="card">
          <form onSubmit={handleSummarize}>
            <label className="field">
              <span>O&apos;Reilly URL</span>
              <input
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                type="url"
                placeholder="https://www.oreilly.co.jp/books/..."
                required
              />
            </label>

            <label className="field">
              <span>Provider</span>
              <select value={provider} onChange={(event) => setProvider(event.target.value)}>
                <option value="gemini">Gemini API (Google OAuth)</option>
                <option value="codex">Codex</option>
                <option value="claude">Claude</option>
              </select>
            </label>

            <div className="actions">
              <button className="secondary" type="button" onClick={() => void handleInspect()}>
                まず目次を確認
              </button>
              <button type="submit">本全体を要約する</button>
            </div>
          </form>
        </section>

        <section className="card">
          <h2>抽出した目次</h2>
          {inspection ? (
            <div className="stack">
              <div>
                <strong>{inspection.title}</strong>
                <p>{inspection.authors.join(", ") || "著者不明"}</p>
                <p>{inspection.extractionNotes.join(" ")}</p>
              </div>
              <ol className="toc-list">
                {inspection.tocEntries.map((entry) => (
                  <li key={entry}>{entry}</li>
                ))}
              </ol>
            </div>
          ) : (
            <div className="stack muted">{inspectionMessage}</div>
          )}
        </section>

        <section className="card">
          <div className="section-head">
            <div>
              <h2>章ごとのチャット</h2>
              <p className="muted small">
                左の章を選ぶと、その章の目次だけを前提に質問できます。
              </p>
            </div>
            <span className="mini-badge">{provider}</span>
          </div>

          {inspection?.chapters.length ? (
            <div className="chapter-workspace">
              <aside className="chapter-sidebar">
                {inspection.chapters.map((chapter) => (
                  <button
                    key={chapter.id}
                    type="button"
                    className={`chapter-link ${
                      selectedChapterId === chapter.id ? "is-active" : ""
                    }`}
                    onClick={() => {
                      setSelectedChapterId(chapter.id);
                      setChatMessage(chapterChats[chapter.id]?.length ? "" : EMPTY_CHAT_MESSAGE);
                    }}
                  >
                    <span className="chapter-link-title">{chapter.title}</span>
                    {chapter.partTitle ? (
                      <span className="chapter-link-meta">{chapter.partTitle}</span>
                    ) : null}
                    <span className="chapter-link-meta">
                      {Math.max(chapter.tocEntries.length - 1, 1)} 項目
                    </span>
                  </button>
                ))}
              </aside>

              <div className="chapter-panel">
                {selectedChapter ? (
                  <>
                    <div className="chapter-panel-head">
                      <div>
                        {selectedChapter.partTitle ? (
                          <p className="eyebrow chapter-eyebrow">{selectedChapter.partTitle}</p>
                        ) : null}
                        <h3>{selectedChapter.title}</h3>
                      </div>
                      <span className="mini-badge">
                        {Math.floor(selectedChatHistory.length / 2)}
                        {" "}
                        turn
                      </span>
                    </div>

                    <div className="chapter-outline">
                      <h4>この章の目次</h4>
                      <ol className="toc-list">
                        {renderChapterOutline(selectedChapter).map((entry) => (
                          <li key={entry}>{entry}</li>
                        ))}
                      </ol>
                    </div>

                    <div className="chat-thread">
                      {selectedChatHistory.length > 0 ? (
                        selectedChatHistory.map((message, index) => (
                          <div
                            className={`chat-bubble ${
                              message.role === "assistant" ? "assistant" : "user"
                            }`}
                            key={`${message.role}-${index}-${message.content}`}
                          >
                            <span className="chat-role">
                              {message.role === "assistant" ? provider : "you"}
                            </span>
                            <p>{message.content}</p>
                          </div>
                        ))
                      ) : (
                        <div className="chat-empty muted">
                          <p>
                            例:
                            {" "}
                            「この章はどんな読者向け？」
                            {" "}
                            「何を学べそう？」
                            {" "}
                            「実務で役立ちそうな論点は？」
                          </p>
                        </div>
                      )}
                    </div>

                    <form className="chat-form" onSubmit={handleChapterChat}>
                      <label className="field">
                        <span>この章について聞く</span>
                        <textarea
                          value={chatInput}
                          onChange={(event) => setChatInput(event.target.value)}
                          placeholder="この章ではどんな話題を扱いそう？"
                          rows={4}
                        />
                      </label>
                      <div className="actions">
                        <button type="submit" disabled={isChatLoading || !chatInput.trim()}>
                          {isChatLoading ? "回答を生成中..." : "質問する"}
                        </button>
                      </div>
                    </form>

                    {chatMessage ? <p className="muted small">{chatMessage}</p> : null}
                  </>
                ) : (
                  <div className="stack muted">
                    <p>左の章を選択してください。</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="stack muted">
              <p>
                {inspection
                  ? "目次は抽出できましたが、章一覧に整理できませんでした。"
                  : "まず URL から目次を抽出してください。"}
              </p>
            </div>
          )}
        </section>

        <section className="card">
          <h2>要約結果</h2>
          {summary ? (
            <div className="stack">
              <div>
                <p>
                  <strong>Provider:</strong> {summaryProvider}
                </p>
                <p>{summary.summary}</p>
              </div>
              <div className="summary-grid">
                <section>
                  <h3>主要テーマ</h3>
                  <ul>
                    {summary.keyTopics.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </section>
                <section>
                  <h3>向いている読者</h3>
                  <ul>
                    {summary.targetAudience.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </section>
                <section>
                  <h3>根拠</h3>
                  <ul>
                    {summary.evidence.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </section>
                <section>
                  <h3>注意点</h3>
                  <ul>
                    {summary.limitations.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </section>
              </div>
              <p>
                <strong>confidence:</strong> {summary.confidence}
              </p>
            </div>
          ) : (
            <div className="stack muted">{summaryMessage}</div>
          )}
        </section>
      </main>

      {isSettingsOpen ? (
        <div className="modal" aria-hidden={false}>
          <div className="modal-backdrop" onClick={() => setIsSettingsOpen(false)} />
          <section className="modal-card" aria-label="設定">
            <div className="modal-head">
              <div>
                <p className="eyebrow">Integrations</p>
                <h2>設定</h2>
              </div>
              <button className="ghost" type="button" onClick={() => setIsSettingsOpen(false)}>
                閉じる
              </button>
            </div>

            <div className="tab-row" role="tablist" aria-label="settings tabs">
              <button
                className={`tab-button ${activeTab === "api" ? "is-active" : ""}`}
                type="button"
                onClick={() => setActiveTab("api")}
              >
                API
              </button>
              <button
                className={`tab-button ${activeTab === "cli" ? "is-active" : ""}`}
                type="button"
                onClick={() => setActiveTab("cli")}
              >
                CLI
              </button>
            </div>

            <div className="settings-feedback muted">
              <p>{settingsMessage}</p>
            </div>

            {activeTab === "api" ? (
              <section className="settings-grid">
                <form className="card inset-card" onSubmit={handleSaveApiSettings}>
                  <h3>Gemini API 設定</h3>
                  <label className="field">
                    <span>Google Client ID</span>
                    <input
                      value={settings.api.googleClientId}
                      onChange={(event) =>
                        setSettings((current) => ({
                          ...current,
                          api: { ...current.api, googleClientId: event.target.value },
                        }))
                      }
                      type="text"
                    />
                  </label>
                  <label className="field">
                    <span>Google Client Secret</span>
                    <input
                      value={settings.api.googleClientSecret}
                      onChange={(event) =>
                        setSettings((current) => ({
                          ...current,
                          api: { ...current.api, googleClientSecret: event.target.value },
                        }))
                      }
                      type="password"
                    />
                  </label>
                  <label className="field">
                    <span>Redirect URI</span>
                    <input
                      value={settings.api.googleRedirectUri}
                      onChange={(event) =>
                        setSettings((current) => ({
                          ...current,
                          api: { ...current.api, googleRedirectUri: event.target.value },
                        }))
                      }
                      type="url"
                      placeholder="http://localhost:3000/auth/google/callback"
                    />
                  </label>
                  <label className="field">
                    <span>Google Cloud Project ID</span>
                    <input
                      value={settings.api.googleCloudProjectId}
                      onChange={(event) =>
                        setSettings((current) => ({
                          ...current,
                          api: { ...current.api, googleCloudProjectId: event.target.value },
                        }))
                      }
                      type="text"
                    />
                  </label>
                  <label className="field">
                    <span>Gemini Model</span>
                    <input
                      value={settings.api.geminiModel}
                      onChange={(event) =>
                        setSettings((current) => ({
                          ...current,
                          api: { ...current.api, geminiModel: event.target.value },
                        }))
                      }
                      type="text"
                      placeholder="gemini-2.5-flash"
                    />
                  </label>
                  <div className="actions">
                    <button type="submit">API 設定を保存</button>
                    <a className="link-button" href="/auth/google/start">
                      Google で接続
                    </a>
                    <button className="secondary" type="button" onClick={handleDisconnectGoogle}>
                      Google 連携を解除
                    </button>
                  </div>
                </form>

                <article className="card inset-card">
                  <h3>API 連携状況</h3>
                  <div className="stack muted">
                    {session?.googleConnected ? (
                      <div className="provider">
                        <div className="provider-row">
                          <strong>
                            {session.user?.name || session.user?.email || "Google user"}
                          </strong>
                          <span className="badge ok">connected</span>
                        </div>
                        <p>{session.user?.email || ""}</p>
                      </div>
                    ) : (
                      <p>Google 連携はまだありません。</p>
                    )}
                    {renderProviderCards(apiProviders)}
                  </div>
                </article>
              </section>
            ) : (
              <section className="settings-grid">
                <form className="card inset-card" onSubmit={handleSaveCliSettings}>
                  <h3>CLI 設定</h3>
                  <label className="field">
                    <span>Codex Command</span>
                    <input
                      value={settings.cli.codexCommand}
                      onChange={(event) =>
                        setSettings((current) => ({
                          ...current,
                          cli: { ...current.cli, codexCommand: event.target.value },
                        }))
                      }
                      type="text"
                      placeholder="codex"
                    />
                  </label>
                  <label className="field">
                    <span>Codex Model</span>
                    <input
                      value={settings.cli.codexModel}
                      onChange={(event) =>
                        setSettings((current) => ({
                          ...current,
                          cli: { ...current.cli, codexModel: event.target.value },
                        }))
                      }
                      type="text"
                      placeholder="未指定なら CLI デフォルト"
                    />
                  </label>
                  <label className="field">
                    <span>Claude Command</span>
                    <input
                      value={settings.cli.claudeCommand}
                      onChange={(event) =>
                        setSettings((current) => ({
                          ...current,
                          cli: { ...current.cli, claudeCommand: event.target.value },
                        }))
                      }
                      type="text"
                      placeholder="claude"
                    />
                  </label>
                  <label className="field">
                    <span>Claude Model</span>
                    <input
                      value={settings.cli.claudeModel}
                      onChange={(event) =>
                        setSettings((current) => ({
                          ...current,
                          cli: { ...current.cli, claudeModel: event.target.value },
                        }))
                      }
                      type="text"
                      placeholder="sonnet"
                    />
                  </label>
                  <div className="actions">
                    <button type="submit">CLI 設定を保存</button>
                  </div>
                  <p className="muted small">
                    CLI のログイン自体はサーバー上で行います。未ログインの場合は provider
                    状態に案内を表示します。
                  </p>
                </form>

                <article className="card inset-card">
                  <h3>CLI 連携状況</h3>
                  <div className="stack muted">{renderProviderCards(cliProviders)}</div>
                </article>
              </section>
            )}
          </section>
        </div>
      ) : null}
    </>
  );
}

function renderProviderCards(providers: Provider[]) {
  if (providers.length === 0) {
    return <p>provider が見つかりません。</p>;
  }

  return providers.map((provider) => (
    <div className="provider" key={provider.id}>
      <div className="provider-row">
        <strong>{provider.name}</strong>
        <div className="badge-row">
          <span className="mini-badge">{provider.kind}</span>
          <span className={`badge ${provider.loggedIn ? "ok" : "warn"}`}>
            {provider.loggedIn ? "ready" : "login required"}
          </span>
        </div>
      </div>
      <p>{provider.detail}</p>
      {provider.connectedAccount ? <p>{provider.connectedAccount}</p> : null}
    </div>
  ));
}

function renderChapterOutline(chapter: Chapter): string[] {
  const outline = chapter.tocEntries.filter(
    (entry, index) =>
      !(
        (index === 0 && entry === chapter.partTitle) ||
        entry === chapter.title
      ),
  );

  return outline.length > 0 ? outline : [chapter.title];
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  const data = (await response.json()) as T & { error?: string };

  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }

  return data;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = (await response.json()) as T & { error?: string };

  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }

  return data;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
