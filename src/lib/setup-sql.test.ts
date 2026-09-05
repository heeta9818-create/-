import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  bundle,
  bundleReinstall,
  bundleReinstallMin,
} from "../../scripts/bundle-migrations.mjs";

describe("붙여넣기용 SQL 파일", () => {
  // 마이그레이션을 고치고 `npm run db:bundle`을 잊으면, 대시보드에 붙여넣는
  // 파일만 옛날 것이 된다. 그 상태로 새 프로젝트를 만들면 앱이 안 돈다.
  it.each([
    ["supabase/setup.sql", bundle],
    ["supabase/reinstall.sql", bundleReinstall],
    ["supabase/reinstall.min.sql", bundleReinstallMin],
  ])("%s 이 마이그레이션과 어긋나지 않는다", async (file, build) => {
    const expected: string = await build();
    const actual = await readFile(path.join(process.cwd(), file), "utf8");

    expect(actual).toBe(expected);
  });
});
