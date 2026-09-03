import type { Metadata, Viewport } from "next";
import { Noto_Sans_KR } from "next/font/google";
import Link from "next/link";
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

const NAV = [
  { href: "/", label: "홈" },
  { href: "/sites", label: "현장" },
  { href: "/estimate", label: "견적계산" },
];

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${notoSansKr.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col">
          <main className="flex-1 pb-24">{children}</main>
        </div>

        <nav className="no-print fixed inset-x-0 bottom-0 border-t border-line bg-surface">
          <div className="mx-auto flex max-w-2xl">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex-1 py-4 text-center text-sm font-medium text-muted transition-colors hover:text-brand"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </nav>
      </body>
    </html>
  );
}
