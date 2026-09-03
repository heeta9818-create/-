"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "홈" },
  { href: "/sites", label: "현장" },
  { href: "/estimate", label: "견적계산" },
  { href: "/settings", label: "설정" },
];

/** 로그인·인증 화면에서는 네비게이션을 감춘다. */
const HIDDEN_PREFIXES = ["/login", "/auth"];

export function AppNav() {
  const pathname = usePathname();

  if (HIDDEN_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return null;
  }

  return (
    <nav className="no-print fixed inset-x-0 bottom-0 border-t border-line bg-surface">
      <div className="mx-auto flex max-w-2xl">
        {NAV.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex-1 py-4 text-center text-sm font-medium transition-colors ${
                active ? "text-brand" : "text-muted hover:text-brand"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
