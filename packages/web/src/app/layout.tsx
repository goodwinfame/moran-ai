import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "墨染 MoRan",
  description: "AI 长篇小说创作平台",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
