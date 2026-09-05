import "./globals.css";

export const metadata = {
  title: "도배 견적 계산기",
  description: "방 크기만 넣으면 벽지 롤 수와 예상 견적이 바로 나옵니다.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
