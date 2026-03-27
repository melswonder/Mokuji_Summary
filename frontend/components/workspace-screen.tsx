"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Bot,
  Hash,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCcw,
  Send,
  Settings2,
  User,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  fetchBook,
  fetchProviders,
  fetchSession,
  fetchSettings,
  fetchThread,
  sendMessage,
} from "@/lib/api";
import type { Book, ProviderStatus, SessionState, SettingsState, Thread } from "@/lib/types";
import { SettingsDrawer } from "@/components/settings-drawer";

type Props = {
  bookId: string;
};

export function WorkspaceScreen({ bookId }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [book, setBook] = useState<Book | null>(null);
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [session, setSession] = useState<SessionState | null>(null);
  const [settings, setSettings] = useState<SettingsState | null>(null);
  const [thread, setThread] = useState<Thread | null>(null);
  const [threadMessage, setThreadMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("ワークスペースを読み込み中です...");
  const [draftMessage, setDraftMessage] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const threadScrollerRef = useRef<HTMLDivElement | null>(null);

  const provider = searchParams.get("provider") || "gemini";
  const chapterId = searchParams.get("chapter");

  const selectedChapter = useMemo(
    () => book?.chapters.find((chapter) => chapter.id === chapterId) ?? null,
    [book, chapterId],
  );

  async function refreshWorkspace() {
    const [bookData, providerData, sessionData, settingsData] = await Promise.all([
      fetchBook(bookId),
      fetchProviders(),
      fetchSession(),
      fetchSettings(),
    ]);
    setBook(bookData.book);
    setProviders(providerData.providers);
    setSession(sessionData.session);
    setSettings(settingsData.settings);
    setStatusMessage("");
  }

  useEffect(() => {
    void refreshWorkspace().catch((error) => {
      setStatusMessage(error instanceof Error ? error.message : String(error));
    });
  }, [bookId]);

  useEffect(() => {
    if (!chapterId) {
      setThread(null);
      return;
    }
    void fetchThread(bookId, chapterId, provider)
      .then((data) => {
        setThread(data.thread);
      })
      .catch((error) => {
        setStatusMessage(error instanceof Error ? error.message : String(error));
      });
  }, [bookId, chapterId, provider]);

  useEffect(() => {
    const node = threadScrollerRef.current;
    if (node) {
      node.scrollTop = node.scrollHeight;
    }
  }, [thread, sending]);

  function updateRoute(next: { chapter?: string | null; provider?: string }) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.chapter === null) {
      params.delete("chapter");
    } else if (next.chapter) {
      params.set("chapter", next.chapter);
    }
    if (next.provider) {
      params.set("provider", next.provider);
    }
    router.replace(`${pathname}?${params.toString()}`);
  }

  async function handleSend(event: FormEvent) {
    event.preventDefault();
    if (!selectedChapter || !draftMessage.trim() || sending) {
      return;
    }
    setSending(true);
    setThreadMessage(`「${selectedChapter.title}」への回答を生成しています...`);
    try {
      const data = await sendMessage(bookId, selectedChapter.id, provider, draftMessage.trim());
      setThread(data.thread);
      setDraftMessage("");
      setThreadMessage("");
    } catch (error) {
      setThreadMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setSending(false);
    }
  }

  const activeProvider = providers.find((item) => item.id === provider);
  const visibleChapters = book?.chapters.filter((chapter) => !chapter.is_archived) ?? [];

  return (
    <>
      <main className="flex h-screen overflow-hidden bg-white font-sans">
        <aside
          className={`${isSidebarOpen ? "w-72" : "w-0"} flex flex-col overflow-hidden border-r border-slate-200 bg-slate-50 transition-all duration-300`}
        >
          <div className="space-y-4 border-b border-slate-200 p-5">
            <button
              type="button"
              onClick={() => router.push("/")}
              className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 transition hover:text-indigo-600"
            >
              <ArrowLeft size={14} />
              Library
            </button>
            <div className="flex items-center gap-3">
              {book?.cover_image_url ? (
                <img src={book.cover_image_url} alt={book.title} className="h-14 w-10 rounded-lg object-cover shadow-sm" />
              ) : (
                <div className="h-14 w-10 rounded-lg bg-slate-200" />
              )}
              <div className="min-w-0">
                <h2 className="truncate text-xs font-bold text-slate-800">{book?.title || "Loading..."}</h2>
                <p className="mt-1 truncate text-[10px] font-medium uppercase tracking-wider text-slate-400">
                  {activeProvider?.name || provider}
                </p>
              </div>
            </div>
          </div>

          <nav className="custom-scrollbar flex-1 space-y-1 overflow-y-auto p-2">
            <div className="flex items-center gap-2 px-4 py-3">
              <div className="h-px flex-1 bg-slate-200" />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">Table of Contents</span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            {visibleChapters.map((chapter) => (
              <button
                key={chapter.id}
                type="button"
                onClick={() => updateRoute({ chapter: chapter.id })}
                className={`flex w-full items-center gap-3 rounded-xl p-3 text-left text-xs transition-all ${
                  selectedChapter?.id === chapter.id
                    ? "bg-indigo-600 font-bold text-white shadow-md shadow-indigo-100"
                    : "text-slate-600 hover:bg-slate-200"
                }`}
              >
                <Hash size={14} className={selectedChapter?.id === chapter.id ? "text-indigo-200" : "text-slate-400"} />
                <span className="truncate">{chapter.title}</span>
              </button>
            ))}
          </nav>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col bg-white">
          <header className="z-20 flex h-16 items-center justify-between border-b border-slate-100 px-6">
            <div className="flex min-w-0 items-center gap-4">
              <button
                type="button"
                onClick={() => setIsSidebarOpen((current) => !current)}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-50"
              >
                {isSidebarOpen ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
              </button>
              <div className="min-w-0">
                <h2 className="truncate text-sm font-black text-slate-800">
                  {selectedChapter?.title || "章を選択してください"}
                </h2>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Active Chat Thread</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex rounded-full bg-slate-100 p-1">
                {["gemini", "codex", "claude"].map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => updateRoute({ provider: item })}
                    className={`rounded-full px-3 py-2 text-xs font-bold capitalize ${
                      provider === item ? "bg-indigo-600 text-white" : "text-slate-500"
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-50"
                onClick={() => void refreshWorkspace()}
                aria-label="再読み込み"
              >
                <RefreshCcw size={18} />
              </button>
              <button
                type="button"
                className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-50"
                onClick={() => setDrawerOpen(true)}
                aria-label="設定"
              >
                <Settings2 size={18} />
              </button>
            </div>
          </header>

          <div ref={threadScrollerRef} className="custom-scrollbar flex-1 overflow-y-auto p-6 md:px-20">
            {selectedChapter ? (
              <>
                <div className="mb-8 rounded-[28px] border border-slate-100 bg-slate-50 px-6 py-5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Context</p>
                  <h3 className="mt-2 text-lg font-black text-slate-900">{selectedChapter.title}</h3>
                  <p className="mt-2 text-sm text-slate-500">
                    {selectedChapter.part_title || "章単位の文脈で会話します"} / {(thread?.messages.length ?? 0)} messages
                  </p>
                </div>

                {(thread?.messages || []).length === 0 ? (
                  <div className="flex min-h-[55vh] flex-col items-center justify-center space-y-4 text-center opacity-40">
                    <div className="rounded-full bg-slate-50 p-6">
                      <MessageSquare size={64} strokeWidth={1} />
                    </div>
                    <div>
                      <p className="text-sm font-black uppercase tracking-widest">対話を開始してください</p>
                      <p className="mt-1 text-xs text-slate-500">
                        このスレッドでは「{selectedChapter.title}」について議論できます
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-8">
                    {thread?.messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex gap-5 ${message.role === "user" ? "flex-row-reverse" : "flex-row"}`}
                      >
                        <div
                          className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl text-xs font-bold shadow-sm ${
                            message.role === "user"
                              ? "bg-indigo-600 text-white"
                              : "border bg-white text-slate-500"
                          }`}
                        >
                          {message.role === "user" ? <User size={18} /> : <Bot size={18} />}
                        </div>
                        <div className={`max-w-[75%] ${message.role === "user" ? "text-right" : "text-left"}`}>
                          <div
                            className={`inline-block whitespace-pre-wrap rounded-3xl p-5 text-sm leading-relaxed shadow-sm ${
                              message.role === "user"
                                ? "rounded-tr-none bg-indigo-600 text-white"
                                : "rounded-tl-none border border-slate-100 bg-white text-slate-800"
                            }`}
                          >
                            {message.content}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {sending ? (
                  <div className="mt-8 flex gap-5 animate-pulse">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl border bg-white text-slate-400">
                      <Bot size={18} />
                    </div>
                    <div className="flex w-24 items-center justify-center gap-1.5 rounded-3xl rounded-tl-none border border-slate-100 bg-slate-50 p-5">
                      <div className="h-2 w-2 animate-bounce rounded-full bg-slate-300" />
                      <div className="h-2 w-2 animate-bounce rounded-full bg-slate-300 [animation-delay:0.2s]" />
                      <div className="h-2 w-2 animate-bounce rounded-full bg-slate-300 [animation-delay:0.4s]" />
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="flex min-h-full items-center justify-center text-slate-500">{statusMessage}</div>
            )}
          </div>

          <footer className="bg-white p-6">
            <form
              onSubmit={handleSend}
              className="relative mx-auto max-w-4xl overflow-hidden rounded-2xl border border-slate-100 shadow-2xl shadow-indigo-100"
            >
              <input
                type="text"
                value={draftMessage}
                onChange={(event) => setDraftMessage(event.target.value)}
                placeholder={selectedChapter ? "メッセージを入力..." : "先に章を選択してください"}
                disabled={!selectedChapter}
                className="w-full bg-slate-50 py-5 pl-6 pr-16 text-sm outline-none transition-all focus:bg-white disabled:cursor-not-allowed disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={sending || !draftMessage.trim() || !selectedChapter}
                className="absolute bottom-3 right-3 top-3 flex items-center justify-center rounded-xl bg-indigo-600 px-4 text-white disabled:opacity-30"
              >
                <Send size={18} />
              </button>
            </form>
            <p className="mt-3 text-center text-[10px] font-bold uppercase tracking-widest text-slate-400">
              {threadMessage || "Enter to send message"}
            </p>
          </footer>
        </section>
      </main>

      <SettingsDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        providers={providers}
        session={session}
        settings={settings}
        onRefresh={refreshWorkspace}
      />
    </>
  );
}
