import type { Metadata } from "next";
import { IBM_Plex_Sans_JP, Newsreader } from "next/font/google";

import "./globals.css";

const bodyFont = IBM_Plex_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
});

const headingFont = Newsreader({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-heading",
});

export const metadata: Metadata = {
  title: "Mokuji Summary",
  description: "本の目次ごとにスレッドチャットできるワークスペース",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className={`${bodyFont.variable} ${headingFont.variable}`}>{children}</body>
    </html>
  );
}
