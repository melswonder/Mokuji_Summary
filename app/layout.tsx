import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "O'Reilly Book Summarizer",
  description: "O'Reilly の目次から本の内容を要約する Web アプリ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}

