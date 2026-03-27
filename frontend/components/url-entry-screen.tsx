"use client";

import { FormEvent, MouseEvent, useEffect, useState } from "react";
import { ArrowRight, BookText, Library, Link2, Loader2, Plus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";

import { deleteBook, fetchBooks, inspectBook } from "@/lib/api";
import type { Book } from "@/lib/types";

export function UrlEntryScreen() {
  const router = useRouter();
  const [books, setBooks] = useState<Book[]>([]);
  const [url, setUrl] = useState("");
  const [providerId, setProviderId] = useState("gemini");
  const [message, setMessage] = useState("対応ドメイン: O'Reilly / 翔泳社 / 技術評論社");
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    void fetchBooks()
      .then((data) => {
        setBooks(data.books);
      })
      .catch((error) => {
        setMessage(error instanceof Error ? error.message : String(error));
      });
  }, []);

  function openBook(book: Book) {
    const firstChapter = book.chapters.find((chapter) => !chapter.is_archived);
    const params = new URLSearchParams({
      provider: providerId,
      view: firstChapter ? "chapter" : "overview",
    });
    if (firstChapter) {
      params.set("chapter", firstChapter.id);
    }
    router.push(`/books/${book.id}?${params.toString()}`);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("URL を解析しています...");
    try {
      const { book } = await inspectBook(url, providerId);
      setBooks((current) => [book, ...current.filter((item) => item.id !== book.id)]);
      setModalOpen(false);
      setUrl("");
      openBook(book);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteBook(bookId: string, event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    try {
      await deleteBook(bookId);
      setBooks((current) => current.filter((book) => book.id !== bookId));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <main className="min-h-screen bg-[#f8fafc] px-6 py-8">
      <div className="mx-auto max-w-7xl space-y-10">
        <header className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-5">
            <div className="rounded-[28px] bg-[#4f46e5] p-4 text-white shadow-xl shadow-indigo-200">
              <Library size={32} />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight text-slate-900">AI Chat Library</h1>
              <p className="text-sm font-medium text-slate-500">URL から目次を抽出して、章ごとのチャットを管理します</p>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 shadow-sm">
            {message}
          </div>
        </header>

        <section className="grid grid-cols-2 gap-6 md:grid-cols-4 lg:grid-cols-5">
          {books.length === 0 ? (
            <div className="col-span-full flex min-h-[420px] flex-col items-center justify-center text-center text-slate-300">
              <BookText size={96} strokeWidth={1} />
              <p className="mt-4 text-lg font-bold">右下の「＋」から本を追加してください</p>
            </div>
          ) : (
            books.map((book) => (
              <article key={book.id} onClick={() => openBook(book)} className="group cursor-pointer">
                <div className="relative aspect-[3/4] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-md transition-all group-hover:-translate-y-1 group-hover:shadow-xl">
                  {book.cover_image_url ? (
                    <img
                      src={book.cover_image_url}
                      alt={book.title}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-gradient-to-br from-indigo-500 to-slate-900 text-white">
                      <BookText size={48} />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={(event) => void handleDeleteBook(book.id, event)}
                    className="absolute right-3 top-3 rounded-full bg-white/90 p-2 text-slate-400 opacity-0 transition-all hover:text-red-500 group-hover:opacity-100"
                    aria-label="本を削除"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <h2 className="mt-3 line-clamp-2 text-sm font-bold text-slate-800">{book.title}</h2>
                <p className="mt-1 text-xs text-slate-500">{book.source_site}</p>
              </article>
            ))
          )}
        </section>
      </div>

      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className="fixed bottom-10 right-10 z-50 flex h-16 w-16 items-center justify-center rounded-full bg-[#4f46e5] text-white shadow-2xl shadow-indigo-200 transition hover:bg-[#4338ca]"
      >
        <Plus size={32} />
      </button>

      {modalOpen ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-6 backdrop-blur-md">
          <div className="w-full max-w-md rounded-[32px] bg-white p-8 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-slate-900">書籍を追加</h2>
                <p className="mt-2 text-sm text-slate-500">URL を解析して、目次と書影を取り込みます。</p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100"
                aria-label="閉じる"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-slate-700">本の URL</span>
                <div className="flex items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <Link2 className="h-4 w-4 text-slate-400" />
                  <input
                    type="url"
                    required
                    placeholder="https://..."
                    className="ml-3 w-full bg-transparent text-sm outline-none"
                    value={url}
                    onChange={(event) => setUrl(event.target.value)}
                  />
                </div>
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-slate-700">初期 provider</span>
                <select
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm outline-none"
                  value={providerId}
                  onChange={(event) => setProviderId(event.target.value)}
                >
                  <option value="gemini">Gemini API</option>
                  <option value="codex">Codex</option>
                  <option value="claude">Claude</option>
                </select>
              </label>

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center rounded-2xl bg-[#4f46e5] px-5 py-4 font-bold text-white shadow-lg shadow-indigo-200 disabled:opacity-60"
              >
                {loading ? <Loader2 className="animate-spin" /> : "解析して追加"}
                {loading ? null : <ArrowRight className="ml-2 h-4 w-4" />}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  );
}
