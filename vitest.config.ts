import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    // 기본 실행은 src만. 마이그레이션 테스트는 Postgres가 있어야 해서
    // `npm run test:db`로 따로 돌린다.
    include: ["src/**/*.test.ts", "supabase/test/**/*.test.ts"],
    exclude: process.env.DATABASE_URL ? [] : ["supabase/test/**"],
    environment: "node",
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
});
