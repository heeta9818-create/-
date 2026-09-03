import { createHmac } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Client } from "pg";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import {
  createSupabaseEstimateRepository,
  createSupabaseSettingsRepository,
  createSupabaseSiteRepository,
} from "@/lib/data/supabase-repo";
import { calculateEstimate } from "@/lib/domain/estimate";
import { resolveEstimateInput } from "@/lib/domain/resolve-estimate";
import { DEFAULT_SETTINGS } from "@/lib/domain/settings";
import type { SiteInput } from "@/lib/domain/site";

/**
 * 저장소 코드를 진짜 PostgREST에 대고 돌린다.
 *
 * supabase-repo.ts의 쿼리는 컬럼과 함수 이름을 문자열로 쓴다. 오타가 나도
 * 타입 검사에 안 걸리고, 배포하고 나서 사용자가 눌렀을 때야 터진다.
 * 스키마만 대조하는 것과 실제로 주고받아 보는 것은 다르다.
 *
 * 실행: POSTGREST_BIN=... npm run test:db
 * 없으면 통째로 건너뛴다.
 */

const URL_BASE = process.env.SUPABASE_TEST_URL;
const JWT_SECRET = process.env.SUPABASE_TEST_JWT_SECRET;
const DB_URL = process.env.DATABASE_URL;
const ready = Boolean(URL_BASE && JWT_SECRET && DB_URL);
const describePgrst = ready ? describe : describe.skip;

const ALICE = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const BOB = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

/** Supabase의 anon key / 로그인 토큰과 같은 모양의 JWT를 만든다. */
function signJwt(claims: Record<string, unknown>): string {
  const encode = (value: object) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");

  const header = encode({ alg: "HS256", typ: "JWT" });
  const now = Math.floor(Date.now() / 1000);
  const payload = encode({ iat: now, exp: now + 3600, ...claims });
  const signature = createHmac("sha256", JWT_SECRET!)
    .update(`${header}.${payload}`)
    .digest("base64url");

  return `${header}.${payload}.${signature}`;
}

/**
 * supabase-js는 주소 뒤에 /rest/v1 을 붙인다. 실제 Supabase가 그 경로에
 * PostgREST를 얹어 두기 때문이다. 맨몸 PostgREST는 루트에서 받으므로
 * 그 접두사만 떼어 준다.
 *
 * 경로 앞부분만 손대고 헤더·질의문자열·본문은 그대로 둔다. 즉 저장소가
 * 만들어 보내는 요청 자체는 실제와 같다.
 */
function stripSupabasePrefix(input: RequestInfo | URL, init?: RequestInit) {
  const url = new URL(input instanceof Request ? input.url : String(input));
  url.pathname = url.pathname.replace(/^\/(rest|auth)\/v1/, "");

  return input instanceof Request
    ? fetch(new Request(url, input), init)
    : fetch(url, init);
}

function clientFor(userId?: string): SupabaseClient {
  const token = userId
    ? signJwt({ role: "authenticated", sub: userId })
    : signJwt({ role: "anon" });

  return createClient(URL_BASE!, token, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: stripSupabasePrefix },
  });
}

const asUser = (userId?: string) => async () => clientFor(userId);

const aliceSites = createSupabaseSiteRepository(asUser(ALICE));
const bobSites = createSupabaseSiteRepository(asUser(BOB));
const aliceEstimates = createSupabaseEstimateRepository(asUser(ALICE));
const bobEstimates = createSupabaseEstimateRepository(asUser(BOB));
const anonEstimates = createSupabaseEstimateRepository(asUser());
const aliceSettings = createSupabaseSettingsRepository(asUser(ALICE));
const bobSettings = createSupabaseSettingsRepository(asUser(BOB));

function siteInput(overrides: Partial<SiteInput> = {}): SiteInput {
  return {
    customerName: "김철수",
    phone: "010-1234-5678",
    address: "서울시 강남구",
    pyeong: 32,
    areaBasis: "supply",
    wallpaperKind: "silk",
    includeCeiling: true,
    patterned: false,
    scheduledOn: "2026-09-20",
    status: "confirmed",
    memo: "곰팡이 있음",
    ...overrides,
  };
}

let admin: Client;

beforeAll(async () => {
  if (!ready) return;

  admin = new Client({ connectionString: DB_URL });
  await admin.connect();
  await admin.query(
    `insert into auth.users (id, email) values ($1, 'alice@test'), ($2, 'bob@test')
     on conflict (id) do nothing`,
    [ALICE, BOB],
  );
}, 30_000);

afterAll(async () => {
  if (!ready) return;
  // 테스트가 만든 것만 지운다. 현장을 지우면 견적도 딸려 간다.
  await admin.query("delete from public.sites");
  await admin.query("delete from public.settings");
  await admin.end();
});

describePgrst("현장 저장소", () => {
  it("등록하고 다시 읽으면 값이 그대로다", async () => {
    const created = await aliceSites.create(ALICE, siteInput(), 1_671_760);

    expect(created.customerName).toBe("김철수");
    expect(created.phone).toBe("010-1234-5678");
    expect(created.pyeong).toBe(32);
    expect(created.areaBasis).toBe("supply");
    expect(created.wallpaperKind).toBe("silk");
    expect(created.includeCeiling).toBe(true);
    expect(created.scheduledOn).toBe("2026-09-20");
    expect(created.status).toBe("confirmed");
    expect(created.memo).toBe("곰팡이 있음");
    expect(created.estimateTotal).toBe(1_671_760);

    const found = await aliceSites.get(created.id, ALICE);
    expect(found).toEqual(created);
  });

  it("빈 문자열은 빈 문자열로 돌아온다", async () => {
    // DB에는 null로 넣고 읽을 때 ""로 되돌린다. 폼이 null을 못 다룬다.
    const created = await aliceSites.create(
      ALICE,
      siteInput({ phone: "", address: "", memo: "", scheduledOn: "" }),
      0,
    );

    expect(created.phone).toBe("");
    expect(created.address).toBe("");
    expect(created.memo).toBe("");
    expect(created.scheduledOn).toBe("");
  });

  it("수정이 반영된다", async () => {
    const created = await aliceSites.create(ALICE, siteInput(), 0);
    const updated = await aliceSites.update(
      created.id,
      ALICE,
      siteInput({ customerName: "이영희", status: "done" }),
      2_000_000,
    );

    expect(updated?.customerName).toBe("이영희");
    expect(updated?.status).toBe("done");
    expect(updated?.estimateTotal).toBe(2_000_000);
  });

  it("남의 현장은 안 보이고 못 고친다", async () => {
    const created = await aliceSites.create(ALICE, siteInput(), 0);

    expect(await bobSites.get(created.id, BOB)).toBeNull();
    expect(await bobSites.update(created.id, BOB, siteInput(), 1)).toBeNull();

    await bobSites.remove(created.id, BOB);
    expect(await aliceSites.get(created.id, ALICE)).not.toBeNull();
  });

  it("목록은 최근 등록이 먼저 온다", async () => {
    const before = await aliceSites.list(ALICE);
    await aliceSites.create(ALICE, siteInput({ customerName: "최신" }), 0);

    const after = await aliceSites.list(ALICE);
    expect(after).toHaveLength(before.length + 1);
    expect(after[0].customerName).toBe("최신");
  });

  it("금액만 갱신할 수 있다", async () => {
    const created = await aliceSites.create(ALICE, siteInput(), 100);
    await aliceSites.setEstimateTotal(created.id, ALICE, 555_000);

    expect((await aliceSites.get(created.id, ALICE))?.estimateTotal).toBe(555_000);
  });
});

describePgrst("견적 저장소", () => {
  async function newEstimate(label: string) {
    const input = resolveEstimateInput(
      {
        scope: { method: "pyeong", pyeong: 32, basis: "supply" },
        kind: "silk",
        includeCeiling: true,
      },
      DEFAULT_SETTINGS,
    );
    return { label, memo: "", input, result: calculateEstimate(input) };
  }

  it("저장하고 읽으면 입력과 결과가 그대로다", async () => {
    const site = await aliceSites.create(ALICE, siteInput(), 0);
    const data = await newEstimate("1차");
    const saved = await aliceEstimates.create(ALICE, site.id, data);

    expect(saved.version).toBe(1);
    expect(saved.total).toBe(data.result.total);
    expect(saved.shareToken).toBeNull();

    const found = await aliceEstimates.get(saved.id, ALICE);
    expect(found?.input).toEqual(data.input);
    expect(found?.result).toEqual(data.result);
  });

  it("차수가 올라가고 최근 것이 먼저 온다", async () => {
    const site = await aliceSites.create(ALICE, siteInput(), 0);
    await aliceEstimates.create(ALICE, site.id, await newEstimate("1차"));
    await aliceEstimates.create(ALICE, site.id, await newEstimate("2차"));

    const list = await aliceEstimates.listForSite(site.id, ALICE);
    expect(list.map((row) => row.version)).toEqual([2, 1]);
  });

  it("남의 현장에는 저장할 수 없다", async () => {
    const site = await aliceSites.create(ALICE, siteInput(), 0);

    await expect(
      bobEstimates.create(BOB, site.id, await newEstimate("탈취")),
    ).rejects.toThrow();
  });

  it("견적이 있는 현장 id를 찾는다", async () => {
    const withEstimate = await aliceSites.create(ALICE, siteInput(), 0);
    const without = await aliceSites.create(ALICE, siteInput(), 0);
    await aliceEstimates.create(ALICE, withEstimate.id, await newEstimate(""));

    const ids = await aliceEstimates.siteIdsWithEstimates(ALICE);
    expect(ids).toContain(withEstimate.id);
    expect(ids).not.toContain(without.id);
  });

  it("공유를 켜면 로그인 없이 조회된다", async () => {
    const site = await aliceSites.create(
      ALICE,
      siteInput({ customerName: "최민수", address: "용인시 수지구" }),
      0,
    );
    const saved = await aliceEstimates.create(ALICE, site.id, {
      ...(await newEstimate("1차")),
      memo: "내부메모: 마진 더 붙일 것",
    });

    const token = await aliceEstimates.enableSharing(saved.id, ALICE);
    expect(token).toMatch(/^[0-9a-f]{32}$/);

    const shared = await anonEstimates.findShared(token!);
    expect(shared?.customerName).toBe("최민수");
    expect(shared?.address).toBe("용인시 수지구");
    expect(shared?.result.total).toBe(saved.result.total);
    expect(JSON.stringify(shared)).not.toContain("마진 더 붙일 것");
  });

  it("다시 켜도 링크가 그대로고, 끄면 죽는다", async () => {
    const site = await aliceSites.create(ALICE, siteInput(), 0);
    const saved = await aliceEstimates.create(ALICE, site.id, await newEstimate(""));

    const first = await aliceEstimates.enableSharing(saved.id, ALICE);
    expect(await aliceEstimates.enableSharing(saved.id, ALICE)).toBe(first);

    await aliceEstimates.disableSharing(saved.id, ALICE);
    expect(await anonEstimates.findShared(first!)).toBeNull();
  });

  it("남의 견적은 공유를 켤 수 없다", async () => {
    const site = await aliceSites.create(ALICE, siteInput(), 0);
    const saved = await aliceEstimates.create(ALICE, site.id, await newEstimate(""));

    expect(await bobEstimates.enableSharing(saved.id, BOB)).toBeNull();
  });

  it("틀린 열쇠로는 안 나온다", async () => {
    expect(await anonEstimates.findShared("0".repeat(32))).toBeNull();
    expect(await anonEstimates.findShared("")).toBeNull();
  });
});

describePgrst("단가표 저장소", () => {
  it("저장한 적 없으면 기본 단가표", async () => {
    expect(await bobSettings.get(BOB)).toEqual(DEFAULT_SETTINGS);
  });

  it("저장하고 덮어쓴다", async () => {
    const mine = { ...DEFAULT_SETTINGS, dailyWage: 300_000, marginRate: 0.25 };
    await aliceSettings.save(ALICE, mine);
    expect(await aliceSettings.get(ALICE)).toEqual(mine);

    const changed = { ...mine, dailyWage: 200_000 };
    await aliceSettings.save(ALICE, changed);
    expect(await aliceSettings.get(ALICE)).toEqual(changed);
  });

  it("남의 단가표는 안 보인다", async () => {
    await aliceSettings.save(ALICE, {
      ...DEFAULT_SETTINGS,
      dailyWage: 999_000,
    });

    expect((await bobSettings.get(BOB)).dailyWage).toBe(
      DEFAULT_SETTINGS.dailyWage,
    );
  });
});
