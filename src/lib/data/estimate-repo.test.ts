import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { calculateEstimate, type EstimateInput } from "@/lib/domain/estimate";
import type { SiteInput } from "@/lib/domain/site";
import type { EstimateRepository, SiteRepository } from "./repository";

const ALICE = "11111111-1111-1111-1111-111111111111";
const BOB = "22222222-2222-2222-2222-222222222222";

function siteInput(overrides: Partial<SiteInput> = {}): SiteInput {
  return {
    customerName: "김철수",
    phone: "",
    address: "",
    pyeong: 32,
    areaBasis: "supply",
    wallpaperKind: "silk",
    includeCeiling: true,
    patterned: false,
    scheduledOn: "",
    status: "confirmed",
    memo: "",
    ...overrides,
  };
}

function estimateInput(overrides: Partial<EstimateInput> = {}): EstimateInput {
  return {
    scope: { method: "pyeong", pyeong: 32, basis: "supply" },
    kind: "silk",
    includeCeiling: true,
    ...overrides,
  };
}

function newEstimate(label: string, input = estimateInput()) {
  return { label, memo: "", input, result: calculateEstimate(input) };
}

let workdir: string;
let originalCwd: string;
let sites: SiteRepository;
let estimates: EstimateRepository;

beforeEach(async () => {
  originalCwd = process.cwd();
  workdir = await mkdtemp(path.join(tmpdir(), "dobae-est-"));
  process.chdir(workdir);

  vi.resetModules();
  const mod = await import("./file-repo");
  sites = mod.fileSiteRepository;
  estimates = mod.fileEstimateRepository;
});

afterEach(async () => {
  process.chdir(originalCwd);
  await rm(workdir, { recursive: true, force: true });
});

describe("견적 이력 — 저장과 차수", () => {
  it("첫 견적은 1차", async () => {
    const site = await sites.create(ALICE, siteInput(), 0);
    const saved = await estimates.create(ALICE, site.id, newEstimate(""));

    expect(saved.version).toBe(1);
    expect(saved.siteId).toBe(site.id);
    expect(saved.total).toBe(saved.result.total);
  });

  it("같은 현장에 저장할수록 차수가 올라간다", async () => {
    const site = await sites.create(ALICE, siteInput(), 0);

    const first = await estimates.create(ALICE, site.id, newEstimate("1차"));
    const second = await estimates.create(ALICE, site.id, newEstimate("2차"));
    const third = await estimates.create(ALICE, site.id, newEstimate("3차"));

    expect([first.version, second.version, third.version]).toEqual([1, 2, 3]);
  });

  it("차수는 현장마다 따로 매겨진다", async () => {
    const siteA = await sites.create(ALICE, siteInput(), 0);
    const siteB = await sites.create(ALICE, siteInput({ customerName: "박영수" }), 0);

    await estimates.create(ALICE, siteA.id, newEstimate(""));
    const onB = await estimates.create(ALICE, siteB.id, newEstimate(""));

    expect(onB.version).toBe(1);
  });

  it("중간 차수를 지워도 번호를 재사용하지 않는다", async () => {
    // 이미 보낸 "2차 견적"이 나중에 다른 견적을 가리키면 안 된다.
    const site = await sites.create(ALICE, siteInput(), 0);
    await estimates.create(ALICE, site.id, newEstimate("1차"));
    const second = await estimates.create(ALICE, site.id, newEstimate("2차"));

    await estimates.remove(second.id, ALICE);
    const next = await estimates.create(ALICE, site.id, newEstimate("새 견적"));

    expect(next.version).toBe(3);
  });

  it("최근 차수가 먼저 온다", async () => {
    const site = await sites.create(ALICE, siteInput(), 0);
    await estimates.create(ALICE, site.id, newEstimate("1차"));
    await estimates.create(ALICE, site.id, newEstimate("2차"));

    const list = await estimates.listForSite(site.id, ALICE);
    expect(list.map((row) => row.version)).toEqual([2, 1]);
  });
});

describe("견적 이력 — 스냅샷", () => {
  it("저장한 계산 결과가 그대로 남는다", async () => {
    const site = await sites.create(ALICE, siteInput(), 0);
    const input = estimateInput({ rollPrice: 40_000, marginRate: 0.2 });
    const saved = await estimates.create(ALICE, site.id, newEstimate("", input));

    const found = await estimates.get(saved.id, ALICE);
    expect(found?.result.total).toBe(saved.result.total);
    expect(found?.result.items).toEqual(saved.result.items);
    expect(found?.input.rollPrice).toBe(40_000);
  });

  it("입력을 그대로 보관해 다시 계산할 수 있다", async () => {
    const site = await sites.create(ALICE, siteInput(), 0);
    const input = estimateInput({
      scope: {
        method: "measured",
        rooms: [{ name: "안방", widthM: 3.5, depthM: 3, heightM: 2.3, doors: 1 }],
      },
    });
    const saved = await estimates.create(ALICE, site.id, newEstimate("", input));

    const found = await estimates.get(saved.id, ALICE);
    expect(found?.input.scope).toEqual(input.scope);
    expect(calculateEstimate(found!.input).total).toBe(saved.result.total);
  });
});

describe("견적 이력 — 스냅샷 불변", () => {
  it("읽을 때 다시 계산하지 않는다", async () => {
    // 저장된 result를 읽는 쪽에서 input으로 재계산해 버리면, 나중에 견적
    // 엔진이나 기본 단가를 손볼 때 이미 보낸 견적서 금액이 바뀐다.
    // 일부러 계산 결과와 다른 값을 넣어 두고, 그 값이 그대로 나오는지 본다.
    const site = await sites.create(ALICE, siteInput(), 0);
    const input = estimateInput();
    const fresh = calculateEstimate(input);

    const doctored = {
      label: "옛날 단가로 잡은 견적",
      memo: "",
      input,
      result: { ...fresh, total: 12_345_678, rolls: 99 },
    };
    const saved = await estimates.create(ALICE, site.id, doctored);

    const found = await estimates.get(saved.id, ALICE);
    expect(found?.result.total).toBe(12_345_678);
    expect(found?.result.rolls).toBe(99);
    expect(found?.total).toBe(12_345_678);
    expect(calculateEstimate(found!.input).total).not.toBe(12_345_678);
  });
});

describe("견적 이력 — 사용자 격리", () => {
  it("남의 견적은 목록에 안 나온다", async () => {
    const site = await sites.create(ALICE, siteInput(), 0);
    await estimates.create(ALICE, site.id, newEstimate(""));

    expect(await estimates.listForSite(site.id, BOB)).toEqual([]);
  });

  it("id를 알아도 남의 견적은 못 읽는다", async () => {
    const site = await sites.create(ALICE, siteInput(), 0);
    const saved = await estimates.create(ALICE, site.id, newEstimate(""));

    expect(await estimates.get(saved.id, BOB)).toBeNull();
  });

  it("남의 견적은 삭제되지 않는다", async () => {
    const site = await sites.create(ALICE, siteInput(), 0);
    const saved = await estimates.create(ALICE, site.id, newEstimate(""));

    await estimates.remove(saved.id, BOB);
    expect(await estimates.get(saved.id, ALICE)).not.toBeNull();
  });
});

describe("현장 삭제", () => {
  it("현장을 지우면 그 현장의 견적도 사라진다", async () => {
    const site = await sites.create(ALICE, siteInput(), 0);
    const other = await sites.create(ALICE, siteInput({ customerName: "박영수" }), 0);
    const saved = await estimates.create(ALICE, site.id, newEstimate(""));
    const kept = await estimates.create(ALICE, other.id, newEstimate(""));

    await sites.remove(site.id, ALICE);

    expect(await estimates.get(saved.id, ALICE)).toBeNull();
    expect(await estimates.get(kept.id, ALICE)).not.toBeNull();
  });
});

describe("공개 링크", () => {
  it("공유를 켜면 열쇠가 생기고 로그인 없이 조회된다", async () => {
    const site = await sites.create(ALICE, siteInput(), 0);
    const saved = await estimates.create(ALICE, site.id, newEstimate("1차"));

    expect(saved.shareToken).toBeNull();

    const token = await estimates.enableSharing(saved.id, ALICE);
    expect(token).toBeTruthy();
    expect(token!.length).toBeGreaterThanOrEqual(32);

    const shared = await estimates.findShared(token!);
    expect(shared?.customerName).toBe("김철수");
    expect(shared?.result.total).toBe(saved.result.total);
  });

  it("다시 눌러도 링크가 바뀌지 않는다", async () => {
    // 이미 고객에게 보낸 링크가 다시 공유했다는 이유로 죽으면 안 된다.
    const site = await sites.create(ALICE, siteInput(), 0);
    const saved = await estimates.create(ALICE, site.id, newEstimate(""));

    const first = await estimates.enableSharing(saved.id, ALICE);
    const second = await estimates.enableSharing(saved.id, ALICE);
    expect(second).toBe(first);
  });

  it("내부 메모는 고객에게 넘어가지 않는다", async () => {
    const site = await sites.create(ALICE, siteInput(), 0);
    const saved = await estimates.create(ALICE, site.id, {
      ...newEstimate(""),
      memo: "자재 마진 더 붙일 것",
    });

    const token = await estimates.enableSharing(saved.id, ALICE);
    const shared = await estimates.findShared(token!);

    expect(shared).not.toBeNull();
    expect(JSON.stringify(shared)).not.toContain("마진 더 붙일 것");
    expect(shared).not.toHaveProperty("memo");
  });

  it("공유를 끄면 링크가 죽는다", async () => {
    const site = await sites.create(ALICE, siteInput(), 0);
    const saved = await estimates.create(ALICE, site.id, newEstimate(""));
    const token = await estimates.enableSharing(saved.id, ALICE);

    await estimates.disableSharing(saved.id, ALICE);

    expect(await estimates.findShared(token!)).toBeNull();
    expect((await estimates.get(saved.id, ALICE))?.shareToken).toBeNull();
  });

  it("틀린 열쇠로는 아무것도 안 나온다", async () => {
    const site = await sites.create(ALICE, siteInput(), 0);
    const saved = await estimates.create(ALICE, site.id, newEstimate(""));
    await estimates.enableSharing(saved.id, ALICE);

    for (const token of ["", "0".repeat(32), "없는열쇠"]) {
      expect(await estimates.findShared(token)).toBeNull();
    }
  });

  it("남의 견적은 공유를 켤 수 없다", async () => {
    const site = await sites.create(ALICE, siteInput(), 0);
    const saved = await estimates.create(ALICE, site.id, newEstimate(""));

    expect(await estimates.enableSharing(saved.id, BOB)).toBeNull();
    expect((await estimates.get(saved.id, ALICE))?.shareToken).toBeNull();
  });

  it("남이 공유를 끌 수 없다", async () => {
    const site = await sites.create(ALICE, siteInput(), 0);
    const saved = await estimates.create(ALICE, site.id, newEstimate(""));
    const token = await estimates.enableSharing(saved.id, ALICE);

    await estimates.disableSharing(saved.id, BOB);
    expect(await estimates.findShared(token!)).not.toBeNull();
  });

  it("견적을 지우면 링크도 죽는다", async () => {
    const site = await sites.create(ALICE, siteInput(), 0);
    const saved = await estimates.create(ALICE, site.id, newEstimate(""));
    const token = await estimates.enableSharing(saved.id, ALICE);

    await estimates.remove(saved.id, ALICE);
    expect(await estimates.findShared(token!)).toBeNull();
  });

  it("현장을 지우면 링크도 죽는다", async () => {
    const site = await sites.create(ALICE, siteInput(), 0);
    const saved = await estimates.create(ALICE, site.id, newEstimate(""));
    const token = await estimates.enableSharing(saved.id, ALICE);

    await sites.remove(site.id, ALICE);
    expect(await estimates.findShared(token!)).toBeNull();
  });

  it("견적마다 열쇠가 다르다", async () => {
    const site = await sites.create(ALICE, siteInput(), 0);
    const a = await estimates.create(ALICE, site.id, newEstimate("1차"));
    const b = await estimates.create(ALICE, site.id, newEstimate("2차"));

    const tokenA = await estimates.enableSharing(a.id, ALICE);
    const tokenB = await estimates.enableSharing(b.id, ALICE);

    expect(tokenA).not.toBe(tokenB);
    expect((await estimates.findShared(tokenA!))?.version).toBe(1);
    expect((await estimates.findShared(tokenB!))?.version).toBe(2);
  });
});

describe("동시 저장", () => {
  // 요청이 겹치면 서로의 변경을 덮어써서 데이터가 사라지던 문제의 회귀 테스트.
  it("한꺼번에 저장해도 전부 남고 차수가 겹치지 않는다", async () => {
    const site = await sites.create(ALICE, siteInput(), 0);

    const saved = await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        estimates.create(ALICE, site.id, newEstimate(`${i}번`)),
      ),
    );

    const list = await estimates.listForSite(site.id, ALICE);
    expect(list).toHaveLength(12);
    expect(new Set(saved.map((row) => row.version)).size).toBe(12);
    expect(list.map((row) => row.version).sort((a, b) => a - b)).toEqual(
      Array.from({ length: 12 }, (_, i) => i + 1),
    );
  });

  it("현장을 한꺼번에 등록해도 전부 남는다", async () => {
    await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        sites.create(ALICE, siteInput({ customerName: `고객${i}` }), 0),
      ),
    );

    expect(await sites.list(ALICE)).toHaveLength(12);
  });

  it("등록과 삭제가 섞여도 남아야 할 것만 남는다", async () => {
    const site = await sites.create(ALICE, siteInput(), 0);
    const first = await estimates.create(ALICE, site.id, newEstimate("지울 것"));

    await Promise.all([
      estimates.create(ALICE, site.id, newEstimate("A")),
      estimates.remove(first.id, ALICE),
      estimates.create(ALICE, site.id, newEstimate("B")),
    ]);

    const list = await estimates.listForSite(site.id, ALICE);
    expect(list.map((row) => row.label).sort()).toEqual(["A", "B"]);
  });
});

describe("현장 금액 갱신", () => {
  it("본인 현장의 금액만 바뀐다", async () => {
    const site = await sites.create(ALICE, siteInput(), 100);

    await sites.setEstimateTotal(site.id, BOB, 999);
    expect((await sites.get(site.id, ALICE))?.estimateTotal).toBe(100);

    await sites.setEstimateTotal(site.id, ALICE, 2_000_000);
    expect((await sites.get(site.id, ALICE))?.estimateTotal).toBe(2_000_000);
  });
});
