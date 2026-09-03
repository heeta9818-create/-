import type { Metadata, Viewport } from "next";
import { Noto_Sans_KR } from "next/font/google";
import { AppNav } from "@/components/app-nav";
import "./globals.css";

const notoSansKr = Noto_Sans_KR({
  variable: "--font-sans-kr",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "도배장이 — 현장·견적 관리",
  description: "도배 기사·사장님을 위한 현장 일정과 견적 관리 도구",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1d4ed8",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${notoSansKr.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col">
          <main className="flex-1 pb-24">{children}</main>
        </div>

        <AppNav />
      </body>
    </html>
  );
}
