import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { bundle } from "../../scripts/bundle-migrations.mjs";

describe("붙여넣기용 setup.sql", () => {
  it("마이그레이션과 내용이 어긋나지 않는다", async () => {
    // 마이그레이션을 고치고 `npm run db:bundle`을 잊으면, 대시보드에 붙여넣는
    // 파일만 옛날 것이 된다. 그 상태로 새 프로젝트를 만들면 앱이 안 돈다.
    const expected: string = await bundle();
    const actual = await readFile(
      path.join(process.cwd(), "supabase/setup.sql"),
      "utf8",
    );

    expect(actual).toBe(expected);
  });
});
