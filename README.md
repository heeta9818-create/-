# 도배 견적 계산기

방 크기를 입력하면 필요한 벽지 롤 수와 예상 견적이 바로 나오는 웹앱입니다.

## 기술 구성 (일부러 최소화)

빌드 에러를 줄이기 위해 꼭 필요한 것만 씁니다.

- Next.js 15 (App Router)
- React 19
- 일반 JavaScript + 일반 CSS

Tailwind, TypeScript, 데이터베이스, 로그인 없음 → 빌드가 실패할 구멍이 거의 없습니다.

## 내 컴퓨터에서 실행하기

```bash
npm install
npm run dev
```

브라우저에서 http://localhost:3000 접속.

## 배포 전 확인 (중요)

Vercel에 올리기 전에 반드시 아래를 먼저 돌려보세요.
여기서 통과하면 Vercel에서도 거의 통과합니다.

```bash
npm run build
```

`✓ Compiled successfully` 가 나오면 정상입니다.

## Vercel 배포 순서

1. https://vercel.com 로그인 (GitHub 계정으로)
2. **Add New → Project**
3. 이 저장소를 **Import**
4. 설정은 **아무것도 건드리지 않습니다**
   - Framework Preset: `Next.js` (자동 인식)
   - Root Directory: `./`
   - Build Command / Output Directory: 비워둔 채로 (자동)
   - Environment Variables: 없음
5. **Deploy** 클릭

## 계산 방식

- 벽 둘레 = 2 × (가로 + 세로)
- 필요 폭수 = 벽 둘레 ÷ 벽지 폭 (올림)
- 1롤당 폭수 = 롤 길이 ÷ (천장 높이 + 10cm 재단 여유) (내림)
- 필요 롤 수 = 필요 폭수 ÷ 1롤당 폭수 (올림)

| 벽지 | 폭 | 1롤 길이 |
|---|---|---|
| 실크벽지 | 106cm | 15.6m |
| 합지벽지 | 93cm | 17.5m |

문·창문 공제, 몰딩, 벽면 상태 등 현장 조건은 반영되지 않습니다.
실제 견적은 현장 확인 후 달라질 수 있습니다.

## 파일 구조

```
package.json      필요한 패키지 목록
next.config.mjs   Next.js 설정 (비어 있음)
app/layout.js     전체 페이지 껍데기
app/page.js       계산기 화면 + 계산 로직
app/globals.css   디자인
```
