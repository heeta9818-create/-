#!/usr/bin/env node
/**
 * 마이그레이션들을 한 파일로 합친다.
 *
 * Supabase 대시보드의 SQL Editor에 파일을 하나씩 붙여넣다 보면 순서를
 * 헷갈리거나 하나를 빠뜨리기 쉽다. 합쳐 두면 한 번에 끝난다.
 *
 * 결과물은 커밋한다. 마이그레이션을 고치고 이 스크립트를 안 돌리면
 * 내용이 어긋나므로, 테스트가 그걸 잡는다.
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DIR = path.join(process.cwd(), "supabase/migrations");
const OUT = path.join(process.cwd(), "supabase/setup.sql");
const RESET = path.join(process.cwd(), "supabase/reset.sql");
const REINSTALL = path.join(process.cwd(), "supabase/reinstall.sql");

export async function bundle() {
  const files = (await readdir(DIR)).filter((f) => f.endsWith(".sql")).sort();

  const parts = [
    "-- 도배장이 — Supabase 최초 설정",
    "--",
    "-- 이 파일은 supabase/migrations/ 의 파일들을 순서대로 합친 것이다.",
    "-- 직접 고치지 말 것. 마이그레이션을 고친 뒤 `npm run db:bundle`로 다시 만든다.",
    "--",
    "-- 쓰는 법: Supabase 대시보드 → SQL Editor → 전체 복사해서 붙여넣고 Run",
    "",
  ];

  for (const file of files) {
    parts.push(
      "",
      `-- ${"=".repeat(66)}`,
      `-- ${file}`,
      `-- ${"=".repeat(66)}`,
      "",
      (await readFile(path.join(DIR, file), "utf8")).trimEnd(),
    );
  }

  return `${parts.join("\n")}\n`;
}

/**
 * 초기화 + 설치를 한 파일로. 설치가 꼬였을 때 이것 하나만 붙여넣으면 된다.
 * 순서를 지켜 두 번 실행하게 하면 그 사이에서 또 헷갈린다.
 */
export async function bundleReinstall() {
  const header = [
    "-- 도배장이 — 싹 지우고 다시 설치",
    "--",
    "-- ⚠️ 저장된 현장·견적·단가표가 사라진다. 로그인 계정은 남는다.",
    "--    설치가 꼬여서 처음부터 다시 할 때만 쓸 것.",
    "--",
    "-- 이 파일은 reset.sql + setup.sql 을 합친 것이다. 직접 고치지 말고",
    "-- `npm run db:bundle` 로 다시 만든다.",
    "--",
    "-- 쓰는 법: SQL Editor 에 전체를 붙여넣고 Run. 한 번이면 끝난다.",
    "",
    "",
  ].join("\n");

  const reset = await readFile(RESET, "utf8");
  return `${header}${reset.trimEnd()}\n\n\n${await bundle()}`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await writeFile(OUT, await bundle(), "utf8");
  await writeFile(REINSTALL, await bundleReinstall(), "utf8");
  console.log("supabase/setup.sql, supabase/reinstall.sql 을 다시 만들었습니다.");
}
