import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SiteInput } from "@/lib/domain/site";
import type { SiteRepository } from "./repository";

const ALICE = "11111111-1111-1111-1111-111111111111";
const BOB = "22222222-2222-2222-2222-222222222222";

function input(overrides: Partial<SiteInput> = {}): SiteInput {
  return {
    customerName: "김철수",
    phone: "010-1234-5678",
    address: "서울시 강남구",
    pyeong: 32,
    areaBasis: "supply",
    wallpaperKind: "silk",
    includeCeiling: true,
    patterned: false,
    scheduledOn: "2026-09-10",
    status: "confirmed",
    memo: "",
    ...overrides,
  };
}

let workdir: string;
let originalCwd: string;
let repo: SiteRepository;

beforeEach(async () => {
  // 저장 경로가 process.cwd() 기준이라 임시 폴더로 옮겨 놓고 모듈을 새로 읽는다.
  originalCwd = process.cwd();
  workdir = await mkdtemp(path.join(tmpdir(), "dobae-repo-"));
  process.chdir(workdir);

  vi.resetModules();
  repo = (await import("./file-repo")).fileSiteRepository;
});

afterEach(async () => {
  process.chdir(originalCwd);
  await rm(workdir, { recursive: true, force: true });
});

describe("파일 저장소 — 저장과 조회", () => {
  it("등록한 현장을 다시 읽어온다", async () => {
    const created = await repo.create(ALICE, input(), 1_453_704);

    expect(created.id).toBeTruthy();
    expect(created.customerName).toBe("김철수");
    expect(created.estimateTotal).toBe(1_453_704);

    const found = await repo.get(created.id, ALICE);
    expect(found?.id).toBe(created.id);
  });

  it("소유자 정보는 도메인 모델에 새어나가지 않는다", async () => {
    const created = await repo.create(ALICE, input(), 100);
    expect(created).not.toHaveProperty("ownerId");
  });

  it("최근에 만든 현장이 먼저 온다", async () => {
    const first = await repo.create(ALICE, input({ customerName: "먼저" }), 100);
    // createdAt이 ISO 문자열이라 같은 밀리초에 만들어지면 순서가 갈리지 않는다.
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = await repo.create(ALICE, input({ customerName: "나중" }), 100);

    const list = await repo.list(ALICE);
    expect(list.map((site) => site.id)).toEqual([second.id, first.id]);
  });
});

describe("파일 저장소 — 사용자 격리", () => {
  it("남의 현장은 목록에 안 나온다", async () => {
    await repo.create(ALICE, input({ customerName: "앨리스 고객" }), 100);
    await repo.create(BOB, input({ customerName: "밥 고객" }), 100);

    const aliceList = await repo.list(ALICE);
    expect(aliceList).toHaveLength(1);
    expect(aliceList[0].customerName).toBe("앨리스 고객");
  });

  it("id를 알아도 남의 현장은 못 읽는다", async () => {
    const created = await repo.create(ALICE, input(), 100);
    expect(await repo.get(created.id, BOB)).toBeNull();
  });

  it("남의 현장은 수정되지 않는다", async () => {
    const created = await repo.create(ALICE, input(), 100);

    const result = await repo.update(
      created.id,
      BOB,
      input({ customerName: "탈취" }),
      999,
    );
    expect(result).toBeNull();

    const untouched = await repo.get(created.id, ALICE);
    expect(untouched?.customerName).toBe("김철수");
  });

  it("남의 현장은 삭제되지 않는다", async () => {
    const created = await repo.create(ALICE, input(), 100);

    await repo.remove(created.id, BOB);
    expect(await repo.get(created.id, ALICE)).not.toBeNull();

    await repo.remove(created.id, ALICE);
    expect(await repo.get(created.id, ALICE)).toBeNull();
  });
});

describe("파일 저장소 — 수정", () => {
  it("본인 현장은 수정된다", async () => {
    const created = await repo.create(ALICE, input(), 100);

    const updated = await repo.update(
      created.id,
      ALICE,
      input({ customerName: "이영희", pyeong: 45 }),
      2_000_000,
    );

    expect(updated?.customerName).toBe("이영희");
    expect(updated?.pyeong).toBe(45);
    expect(updated?.estimateTotal).toBe(2_000_000);
    expect(updated?.createdAt).toBe(created.createdAt);
  });

  it("없는 현장을 수정하면 null", async () => {
    expect(await repo.update("no-such-id", ALICE, input(), 100)).toBeNull();
  });
});

describe("파일 저장소 — 빈 상태", () => {
  it("저장 파일이 없으면 빈 목록", async () => {
    expect(await repo.list(ALICE)).toEqual([]);
  });
});
