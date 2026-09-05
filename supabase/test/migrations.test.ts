import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { Client, Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * 마이그레이션을 진짜 Postgres에 돌려 보는 테스트.
 *
 * SQL은 타입 검사도 린트도 안 걸린다. RLS 정책 한 줄이 틀리면 남의 데이터가
 * 새고, 함수의 search_path 하나가 빠지면 배포하고 나서야 죽는다. 실제로
 * 돌려 보는 것 말고는 확인할 방법이 없다.
 *
 * DATABASE_URL이 없으면 통째로 건너뛴다. `npm run test:db`가 임시 Postgres를
 * 띄우고 이 값을 채워 준다.
 */

const ADMIN_URL = process.env.DATABASE_URL;
const describeDb = ADMIN_URL ? describe : describe.skip;

const ALICE = "11111111-1111-1111-1111-111111111111";
const BOB = "22222222-2222-2222-2222-222222222222";

const MIGRATIONS_DIR = path.join(process.cwd(), "supabase/migrations");
const PREAMBLE = path.join(process.cwd(), "supabase/test/preamble.sql");

let pool: Pool;
let dbName: string;

/** 요청 하나를 흉내낸다. PostgREST가 하듯 역할을 갈아타고 사용자 id를 심는다. */
async function request<T>(
  who: { role: "anon" | "authenticated"; userId?: string },
  run: (client: import("pg").PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(`set local role ${who.role}`);
    if (who.userId) {
      await client.query("select set_config('request.jwt.claim.sub', $1, true)", [
        who.userId,
      ]);
    }
    const result = await run(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

const asAlice = <T>(run: Parameters<typeof request<T>>[1]) =>
  request({ role: "authenticated", userId: ALICE }, run);
const asBob = <T>(run: Parameters<typeof request<T>>[1]) =>
  request({ role: "authenticated", userId: BOB }, run);
const asAnon = <T>(run: Parameters<typeof request<T>>[1]) =>
  request({ role: "anon" }, run);

/** 현장 하나를 만들고 id를 돌려준다. */
async function createSite(userId: string, name = "김철수"): Promise<string> {
  return request({ role: "authenticated", userId }, async (client) => {
    const { rows } = await client.query(
      `insert into public.sites (owner_id, customer_name, pyeong)
       values (auth.uid(), $1, 32) returning id`,
      [name],
    );
    return rows[0].id as string;
  });
}

async function createEstimate(
  userId: string,
  siteId: string,
  label: string,
  total = 1_000_000,
) {
  return request({ role: "authenticated", userId }, async (client) => {
    const { rows } = await client.query(
      `select * from public.create_estimate($1, $2, $3, $4::jsonb, $5::jsonb, $6)`,
      [
        siteId,
        label,
        null,
        JSON.stringify({ kind: "silk" }),
        JSON.stringify({ total }),
        total,
      ],
    );
    return rows[0];
  });
}

beforeAll(async () => {
  if (!ADMIN_URL) return;

  // 실행마다 새 데이터베이스를 만든다. 앞선 실행이 남긴 찌꺼기가 없어야
  // "정말 이 마이그레이션만으로 되는가"를 확인할 수 있다.
  dbName = `dobae_test_${Date.now()}`;
  const admin = new Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`create database ${dbName}`);
  await admin.end();

  const url = new URL(ADMIN_URL);
  url.pathname = `/${dbName}`;
  pool = new Pool({ connectionString: url.toString() });

  // 마지막에 임시 DB를 강제로 지우면, 놀고 있던 연결이 끊기면서 오류를
  // 던진다. 받아 주는 곳이 없으면 vitest가 "unhandled error"로 올린다.
  // 테스트 결과와 무관한 소리라 여기서 삼킨다.
  pool.on("error", () => {});

  const setup = new Client({ connectionString: url.toString() });
  await setup.connect();
  await setup.query(await readFile(PREAMBLE, "utf8"));

  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    await setup.query(await readFile(path.join(MIGRATIONS_DIR, file), "utf8"));
  }

  await setup.query(
    `insert into auth.users (id, email) values ($1, 'alice@test'), ($2, 'bob@test')`,
    [ALICE, BOB],
  );
  await setup.end();
}, 60_000);

afterAll(async () => {
  if (!ADMIN_URL) return;
  await pool?.end();

  const admin = new Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`drop database if exists ${dbName} with (force)`);
  await admin.end();
});

describeDb("마이그레이션이 적용된다", () => {
  it("네 개가 순서대로 올라가고 테이블이 만들어진다", async () => {
    const { rows } = await pool.query(
      `select table_name from information_schema.tables
       where table_schema = 'public' order by table_name`,
    );
    expect(rows.map((r) => r.table_name)).toEqual([
      "estimates",
      "settings",
      "sites",
    ]);
  });

  it("모든 테이블에 RLS가 켜져 있다", async () => {
    const { rows } = await pool.query(
      `select relname, relrowsecurity from pg_class
       where relnamespace = 'public'::regnamespace and relkind = 'r'`,
    );
    for (const row of rows) {
      expect(row.relrowsecurity, row.relname).toBe(true);
    }
  });
});

describeDb("몇 번을 실행해도 괜찮다", () => {
  it("setup.sql 을 세 번 돌려도 오류가 안 난다", async () => {
    // 대시보드에 붙여넣다가 중간에 끊기거나 실수로 두 번 누르는 일은 흔하다.
    // "이미 있습니다"로 막히면 어디까지 됐는지 알 수 없어 손을 못 댄다.
    const setup = await readFile(
      path.join(process.cwd(), "supabase/setup.sql"),
      "utf8",
    );

    for (let round = 0; round < 3; round += 1) {
      await expect(
        pool.query(setup),
        `${round + 2}번째 실행`,
      ).resolves.toBeDefined();
    }
  });

  it("여러 번 돌려도 정책이 늘어나지 않는다", async () => {
    const { rows } = await pool.query(
      `select tablename, count(*)::int as n from pg_policies
       where schemaname = 'public' group by tablename order by tablename`,
    );

    expect(Object.fromEntries(rows.map((r) => [r.tablename, r.n]))).toEqual({
      estimates: 4, // 조회·등록·삭제 + 공유 설정
      settings: 3, // 조회·등록·수정
      sites: 4, // 조회·등록·수정·삭제
    });
  });

  it("중간까지만 실행된 상태에서 다시 실행해도 된다", async () => {
    // 실제로 겪은 상황이다. 처음 붙여넣기가 중간에 실패해 타입만 만들어졌고,
    // 다시 실행하니 42710 "type site_status already exists"로 막혔다.
    // 어디까지 됐는지 모르는 상태에서도 그냥 다시 붙여넣으면 되어야 한다.
    const half = `create database dobae_half_${Date.now()}`;
    const dbHalf = half.split(" ").pop()!;

    const admin = new Client({ connectionString: ADMIN_URL });
    await admin.connect();
    await admin.query(half);
    await admin.end();

    const url = new URL(ADMIN_URL!);
    url.pathname = `/${dbHalf}`;
    const partial = new Client({ connectionString: url.toString() });
    await partial.connect();

    try {
      await partial.query(await readFile(PREAMBLE, "utf8"));

      // 타입만 만들어진 어중간한 상태를 재현한다.
      await partial.query(`
        create type site_status as enum
          ('inquiry','quoted','confirmed','in_progress','done');
        create type area_basis as enum ('supply','exclusive');
      `);

      const setup = await readFile(
        path.join(process.cwd(), "supabase/setup.sql"),
        "utf8",
      );
      await expect(partial.query(setup)).resolves.toBeDefined();

      const { rows } = await partial.query(
        `select table_name from information_schema.tables
         where table_schema = 'public' order by table_name`,
      );
      expect(rows.map((r) => r.table_name)).toEqual([
        "estimates",
        "settings",
        "sites",
      ]);
    } finally {
      await partial.end();
      const cleanup = new Client({ connectionString: ADMIN_URL });
      await cleanup.connect();
      await cleanup.query(`drop database if exists ${dbHalf} with (force)`);
      await cleanup.end();
    }
  }, 30_000);

  it("여러 번 돌려도 데이터가 남아 있다", async () => {
    // create table if not exists 라서 기존 표를 지우지 않는다.
    const siteId = await createSite(ALICE, "다시 실행해도 남아야 함");

    await pool.query(
      await readFile(path.join(process.cwd(), "supabase/setup.sql"), "utf8"),
    );

    const { rows } = await pool.query(
      "select customer_name from public.sites where id = $1",
      [siteId],
    );
    expect(rows[0]?.customer_name).toBe("다시 실행해도 남아야 함");

    // 뒤 테스트가 "앨리스 현장이 하나뿐"을 확인하므로 치운다.
    await pool.query("delete from public.sites where id = $1", [siteId]);
  });
});

describeDb("현장 — 사용자 격리", () => {
  it("본인 현장만 보인다", async () => {
    await createSite(ALICE, "앨리스 고객");
    await createSite(BOB, "밥 고객");

    const alice = await asAlice((c) =>
      c.query("select customer_name from public.sites"),
    );
    expect(alice.rows.map((r) => r.customer_name)).toEqual(["앨리스 고객"]);
  });

  it("남의 id로 등록할 수 없다", async () => {
    await expect(
      asBob((c) =>
        c.query(
          `insert into public.sites (owner_id, customer_name, pyeong)
           values ($1, '탈취', 10)`,
          [ALICE],
        ),
      ),
    ).rejects.toThrow(/row-level security/i);
  });

  it("남의 현장은 수정도 삭제도 안 된다", async () => {
    const siteId = await createSite(ALICE, "건드리지 마");

    const updated = await asBob((c) =>
      c.query("update public.sites set customer_name = '탈취' where id = $1", [
        siteId,
      ]),
    );
    expect(updated.rowCount).toBe(0);

    const deleted = await asBob((c) =>
      c.query("delete from public.sites where id = $1", [siteId]),
    );
    expect(deleted.rowCount).toBe(0);
  });

  it("로그인하지 않으면 아무것도 안 보인다", async () => {
    const { rows } = await asAnon((c) =>
      c.query("select * from public.sites"),
    );
    expect(rows).toHaveLength(0);
  });
});

describeDb("견적 차수", () => {
  it("현장마다 1부터 올라간다", async () => {
    const siteId = await createSite(ALICE);

    const first = await createEstimate(ALICE, siteId, "1차");
    const second = await createEstimate(ALICE, siteId, "2차");

    expect(first.version).toBe(1);
    expect(second.version).toBe(2);
  });

  it("중간 차수를 지워도 번호를 재사용하지 않는다", async () => {
    // 이미 보낸 "2차 견적"이 나중에 다른 견적을 가리키면 안 된다.
    const siteId = await createSite(ALICE);
    await createEstimate(ALICE, siteId, "1차");
    const second = await createEstimate(ALICE, siteId, "2차");

    await asAlice((c) =>
      c.query("delete from public.estimates where id = $1", [second.id]),
    );
    const next = await createEstimate(ALICE, siteId, "새 견적");

    expect(next.version).toBe(3);
  });

  it("동시에 저장해도 차수가 겹치지 않는다", async () => {
    const siteId = await createSite(ALICE);

    const saved = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        createEstimate(ALICE, siteId, `${i}번`),
      ),
    );

    const versions = saved.map((row) => row.version).sort((a, b) => a - b);
    expect(versions).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("남의 현장에는 견적을 못 넣는다", async () => {
    const siteId = await createSite(ALICE);
    await expect(createEstimate(BOB, siteId, "탈취")).rejects.toThrow(
      /현장을 찾을 수 없습니다/,
    );
  });
});

describeDb("견적 스냅샷은 고칠 수 없다", () => {
  it("result를 수정하려 하면 권한 오류", async () => {
    // 저장된 금액이 나중에 바뀌면 이미 보낸 견적서가 거짓이 된다.
    const siteId = await createSite(ALICE);
    const estimate = await createEstimate(ALICE, siteId, "1차");

    await expect(
      asAlice((c) =>
        c.query(
          `update public.estimates set result = '{"total":1}'::jsonb where id = $1`,
          [estimate.id],
        ),
      ),
    ).rejects.toThrow(/permission denied/i);
  });

  it("total이나 label도 마찬가지", async () => {
    const siteId = await createSite(ALICE);
    const estimate = await createEstimate(ALICE, siteId, "1차");

    for (const column of ["total = 1", "label = '위조'"]) {
      await expect(
        asAlice((c) =>
          c.query(`update public.estimates set ${column} where id = $1`, [
            estimate.id,
          ]),
        ),
      ).rejects.toThrow(/permission denied/i);
    }
  });

  it("share_token만은 고칠 수 있다 — 공유를 끄려면 필요하다", async () => {
    const siteId = await createSite(ALICE);
    const estimate = await createEstimate(ALICE, siteId, "1차");

    const result = await asAlice((c) =>
      c.query("update public.estimates set share_token = null where id = $1", [
        estimate.id,
      ]),
    );
    expect(result.rowCount).toBe(1);
  });
});

describeDb("공개 링크", () => {
  async function share(userId: string, estimateId: string): Promise<string> {
    return request({ role: "authenticated", userId }, async (client) => {
      const { rows } = await client.query(
        "select public.enable_estimate_sharing($1) as token",
        [estimateId],
      );
      return rows[0].token as string;
    });
  }

  it("열쇠가 생기고 로그인 없이 조회된다", async () => {
    const siteId = await createSite(ALICE, "최민수");
    const estimate = await createEstimate(ALICE, siteId, "1차", 1_417_695);
    const token = await share(ALICE, estimate.id);

    expect(token).toMatch(/^[0-9a-f]{32}$/);

    const { rows } = await asAnon((c) =>
      c.query("select * from public.find_shared_estimate($1)", [token]),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].customer_name).toBe("최민수");
    expect(rows[0].result).toEqual({ total: 1_417_695 });
  });

  it("search_path가 달라도 열쇠를 만들 수 있다", async () => {
    // gen_random_bytes는 pgcrypto(extensions 스키마)에 있다. 함수가 호출자의
    // search_path에 기대면 설정이 조금만 달라도 죽는다.
    const siteId = await createSite(ALICE);
    const estimate = await createEstimate(ALICE, siteId, "1차");

    const token = await request(
      { role: "authenticated", userId: ALICE },
      async (client) => {
        await client.query("set local search_path = public");
        const { rows } = await client.query(
          "select public.enable_estimate_sharing($1) as token",
          [estimate.id],
        );
        return rows[0].token as string;
      },
    );

    expect(token).toMatch(/^[0-9a-f]{32}$/);
  });

  it("다시 켜도 링크가 바뀌지 않는다", async () => {
    const siteId = await createSite(ALICE);
    const estimate = await createEstimate(ALICE, siteId, "1차");

    expect(await share(ALICE, estimate.id)).toBe(
      await share(ALICE, estimate.id),
    );
  });

  it("내부 메모는 공개 조회 결과에 없다", async () => {
    const siteId = await createSite(ALICE);
    const estimate = await request(
      { role: "authenticated", userId: ALICE },
      async (client) => {
        const { rows } = await client.query(
          `select * from public.create_estimate($1, $2, $3, $4::jsonb, $5::jsonb, $6)`,
          [
            siteId,
            "1차",
            "내부메모: 마진 더 붙일 것",
            JSON.stringify({ kind: "silk" }),
            JSON.stringify({ total: 100 }),
            100,
          ],
        );
        return rows[0];
      },
    );
    const token = await share(ALICE, estimate.id);

    const { rows, fields } = await asAnon((c) =>
      c.query("select * from public.find_shared_estimate($1)", [token]),
    );
    expect(fields.map((f) => f.name)).not.toContain("memo");
    expect(JSON.stringify(rows[0])).not.toContain("마진 더 붙일 것");
  });

  it("로그인 없이 estimates 테이블 자체는 못 읽는다", async () => {
    const { rows } = await asAnon((c) =>
      c.query("select * from public.estimates"),
    );
    expect(rows).toHaveLength(0);
  });

  it("남의 견적은 공유를 켤 수 없다", async () => {
    const siteId = await createSite(ALICE);
    const estimate = await createEstimate(ALICE, siteId, "1차");

    const { rows } = await asBob((c) =>
      c.query("select public.enable_estimate_sharing($1) as token", [
        estimate.id,
      ]),
    );
    expect(rows[0].token).toBeNull();
  });

  it("틀린 열쇠로는 아무것도 안 나온다", async () => {
    for (const token of ["0".repeat(32), "짧음", ""]) {
      const { rows } = await asAnon((c) =>
        c.query("select * from public.find_shared_estimate($1)", [token]),
      );
      expect(rows).toHaveLength(0);
    }
  });

  it("견적을 지우면 링크도 죽는다", async () => {
    const siteId = await createSite(ALICE);
    const estimate = await createEstimate(ALICE, siteId, "1차");
    const token = await share(ALICE, estimate.id);

    await asAlice((c) =>
      c.query("delete from public.estimates where id = $1", [estimate.id]),
    );

    const { rows } = await asAnon((c) =>
      c.query("select * from public.find_shared_estimate($1)", [token]),
    );
    expect(rows).toHaveLength(0);
  });

  it("현장을 지우면 견적과 링크가 함께 사라진다", async () => {
    const siteId = await createSite(ALICE);
    const estimate = await createEstimate(ALICE, siteId, "1차");
    const token = await share(ALICE, estimate.id);

    await asAlice((c) =>
      c.query("delete from public.sites where id = $1", [siteId]),
    );

    const { rows } = await asAnon((c) =>
      c.query("select * from public.find_shared_estimate($1)", [token]),
    );
    expect(rows).toHaveLength(0);
  });
});

describeDb("단가표", () => {
  it("저장하고 다시 읽는다", async () => {
    const settings = { dailyWage: 300_000, marginRate: 0.25 };

    await asAlice((c) =>
      c.query(
        `insert into public.settings (owner_id, data) values (auth.uid(), $1::jsonb)
         on conflict (owner_id) do update set data = excluded.data`,
        [JSON.stringify(settings)],
      ),
    );

    const { rows } = await asAlice((c) =>
      c.query("select data from public.settings"),
    );
    expect(rows[0].data).toEqual(settings);
  });

  it("덮어쓰기(upsert)가 동작한다", async () => {
    for (const wage of [300_000, 200_000]) {
      await asAlice((c) =>
        c.query(
          `insert into public.settings (owner_id, data) values (auth.uid(), $1::jsonb)
           on conflict (owner_id) do update set data = excluded.data`,
          [JSON.stringify({ dailyWage: wage })],
        ),
      );
    }

    const { rows } = await asAlice((c) =>
      c.query("select data from public.settings"),
    );
    expect(rows[0].data).toEqual({ dailyWage: 200_000 });
  });

  it("남의 단가표는 안 보인다", async () => {
    const { rows } = await asBob((c) =>
      c.query("select * from public.settings"),
    );
    expect(rows).toHaveLength(0);
  });

  it("남의 id로 저장할 수 없다", async () => {
    await expect(
      asBob((c) =>
        c.query(
          `insert into public.settings (owner_id, data) values ($1, '{}'::jsonb)`,
          [ALICE],
        ),
      ),
    ).rejects.toThrow(/row-level security/i);
  });
});

describeDb("앱이 기대하는 스키마 — supabase-repo.ts와 맞춰 둔다", () => {
  /**
   * supabase-js는 문자열로 컬럼과 함수를 부른다. 오타가 나도 타입 검사에
   * 안 걸리고 런타임에서야 터진다. 여기서 실제 스키마와 대조해 둔다.
   * 스키마를 고치면 이 테스트가 먼저 깨져서 앱 코드도 같이 고치게 된다.
   */
  async function columnsOf(table: string): Promise<string[]> {
    const { rows } = await pool.query(
      `select column_name from information_schema.columns
       where table_schema = 'public' and table_name = $1
       order by column_name`,
      [table],
    );
    return rows.map((r) => r.column_name as string);
  }

  async function argsOf(fn: string): Promise<string[]> {
    const { rows } = await pool.query(
      `select coalesce(p.proargnames, '{}') as names
       from pg_proc p
       where p.pronamespace = 'public'::regnamespace and p.proname = $1`,
      [fn],
    );
    return (rows[0]?.names ?? []) as string[];
  }

  it("sites 컬럼", async () => {
    // toRow()/toSite()가 읽고 쓰는 이름들
    expect(await columnsOf("sites")).toEqual([
      "address",
      "area_basis",
      "created_at",
      "customer_name",
      "estimate_total",
      "id",
      "include_ceiling",
      "last_estimate_version",
      "memo",
      "owner_id",
      "patterned",
      "phone",
      "pyeong",
      "scheduled_on",
      "status",
      "updated_at",
      "wallpaper_kind",
    ]);
  });

  it("estimates 컬럼", async () => {
    expect(await columnsOf("estimates")).toEqual([
      "created_at",
      "id",
      "input",
      "label",
      "memo",
      "owner_id",
      "result",
      "share_token",
      "site_id",
      "total",
      "version",
    ]);
  });

  it("settings 컬럼", async () => {
    expect(await columnsOf("settings")).toEqual([
      "data",
      "owner_id",
      "updated_at",
    ]);
  });

  it("create_estimate 인자 이름", async () => {
    // supabase-js가 { p_site_id: ... } 형태로 이름을 붙여 부른다.
    expect(await argsOf("create_estimate")).toEqual([
      "p_site_id",
      "p_label",
      "p_memo",
      "p_input",
      "p_result",
      "p_total",
    ]);
  });

  it("enable_estimate_sharing 인자 이름", async () => {
    expect(await argsOf("enable_estimate_sharing")).toEqual(["p_estimate_id"]);
  });

  it("find_shared_estimate 인자와 반환 컬럼", async () => {
    const names = await argsOf("find_shared_estimate");
    expect(names[0]).toBe("p_token");

    const { fields } = await asAnon((c) =>
      c.query("select * from public.find_shared_estimate('x')"),
    );
    expect(fields.map((f) => f.name)).toEqual([
      "version",
      "label",
      "created_at",
      "input",
      "result",
      "customer_name",
      "address",
    ]);
  });

  it("현장 상태 값이 앱의 SITE_STATUSES와 같다", async () => {
    const { rows } = await pool.query(
      `select unnest(enum_range(null::public.site_status))::text as value`,
    );
    expect(rows.map((r) => r.value)).toEqual([
      "inquiry",
      "quoted",
      "confirmed",
      "in_progress",
      "done",
    ]);
  });

  it("벽지 종류와 면적 기준 값도 같다", async () => {
    const { rows: kinds } = await pool.query(
      `select unnest(enum_range(null::public.wallpaper_kind))::text as value`,
    );
    expect(kinds.map((r) => r.value)).toEqual(["silk", "wide", "narrow"]);

    const { rows: basis } = await pool.query(
      `select unnest(enum_range(null::public.area_basis))::text as value`,
    );
    expect(basis.map((r) => r.value)).toEqual(["supply", "exclusive"]);
  });
});
