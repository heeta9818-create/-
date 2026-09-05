#!/usr/bin/env node
/**
 * Supabase 설정이 제대로 됐는지 확인한다.
 *
 *   npm run check:supabase
 *   npm run check:supabase -- --email me@example.com --password '비밀번호'
 *
 * 두 번째 형태는 실제로 로그인해서 현장 등록 → 견적 저장 → 공유 링크 →
 * 로그인 없이 열어 보기까지 한 바퀴 돌린다. 만든 데이터는 지운다.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const OK = "  ✓";
const NO = "  ✗";
const WARN = "  !";

let failed = false;
const fail = (message, hint) => {
  failed = true;
  console.log(`${NO} ${message}`);
  if (hint) console.log(`      → ${hint}`);
};
const pass = (message) => console.log(`${OK} ${message}`);
const warn = (message) => console.log(`${WARN} ${message}`);

/**
 * 서버에 못 닿은 것과 "확인해 봤더니 괜찮더라"는 전혀 다르다.
 * 이걸 구분하지 않으면 연결이 끊긴 상태에서 전부 통과로 보인다.
 */
const isNetworkError = (error) =>
  !!error &&
  /fetch failed|network|ENOTFOUND|ECONNREFUSED|timeout|socket/i.test(
    `${error.message ?? error}`,
  );

/** .env.local 을 읽는다. node 스크립트는 Next.js처럼 자동으로 읽어 주지 않는다. */
async function readEnvLocal() {
  const env = {};
  for (const file of [".env.local", ".env"]) {
    let raw;
    try {
      raw = await readFile(path.join(process.cwd(), file), "utf8");
    } catch {
      continue;
    }
    for (const line of raw.split("\n")) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!match) continue;
      const value = match[2].replace(/^["']|["']$/g, "");
      if (value) env[match[1]] ??= value;
    }
  }
  return env;
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--email") args.email = argv[++i];
    else if (argv[i] === "--password") args.password = argv[++i];
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const env = { ...(await readEnvLocal()), ...process.env };

  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  console.log("\n1. 환경변수");

  if (!url || !key) {
    fail(
      "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 없습니다",
      ".env.example 을 .env.local 로 복사하고 Supabase 대시보드의 Project Settings → API 에서 값을 채우세요.",
    );
    return;
  }
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/.test(url)) {
    warn(`URL 형태가 낯섭니다: ${url}`);
  } else {
    pass(`URL: ${url}`);
  }
  pass(`anon key: ${key.slice(0, 12)}… (${key.length}자)`);

  const anon = createClient(url, key, { auth: { persistSession: false } });

  console.log("\n2. 연결과 표(table)");

  // 먼저 닿는지부터 본다. 못 닿는 채로 아래를 돌리면 전부 실패인데
  // 실패 이유가 제각각으로 보여서 원인을 못 찾는다.
  const reach = await anon.from("sites").select("*").limit(1);
  if (isNetworkError(reach.error)) {
    fail(
      `${url} 에 닿지 못했습니다`,
      "URL의 오타, 인터넷 연결, 그리고 프로젝트가 일시정지(pause) 상태는 아닌지 확인하세요. 무료 프로젝트는 일주일 안 쓰면 멈춥니다.",
    );
    console.log("\n닿지 못해서 나머지 검사는 건너뜁니다.\n");
    process.exitCode = 1;
    return;
  }

  for (const table of ["sites", "estimates", "settings"]) {
    const { error } = await anon.from(table).select("*").limit(1);

    if (!error) {
      pass(`${table} 표가 있습니다`);
    } else if (isNetworkError(error)) {
      fail(`${table}: 서버에 닿지 못했습니다`);
    } else if (error.code === "42P01" || /does not exist/i.test(error.message)) {
      fail(
        `${table} 표가 없습니다`,
        "supabase/setup.sql 전체를 대시보드 SQL Editor에 붙여넣고 Run 하세요.",
      );
    } else if (error.message.includes("Invalid API key")) {
      fail("anon key가 맞지 않습니다", "Project Settings → API 에서 다시 복사하세요.");
      return;
    } else {
      fail(`${table}: ${error.message}`);
    }
  }

  console.log("\n3. 함수");

  const rpcs = [
    ["find_shared_estimate", { p_token: "0".repeat(32) }],
    ["enable_estimate_sharing", { p_estimate_id: "00000000-0000-0000-0000-000000000000" }],
    ["create_estimate", null],
  ];

  for (const [name, params] of rpcs) {
    const { error } = await anon.rpc(name, params ?? {});

    if (isNetworkError(error)) {
      fail(`${name}: 서버에 닿지 못했습니다`);
    } else if (
      error &&
      /could not find the function|does not exist/i.test(error.message)
    ) {
      fail(`${name} 함수가 없습니다`, "setup.sql 을 끝까지 실행했는지 확인하세요.");
    } else if (!error || !params || name === "enable_estimate_sharing") {
      // 인자를 안 넘겼거나 로그인 없이 불렀으면 거부되는 게 정상이다.
      // 여기까지 왔다는 건 함수 자체는 있다는 뜻.
      pass(`${name} 함수가 있습니다`);
    } else {
      fail(`${name}: ${error.message}`);
    }
  }

  console.log("\n4. 잠금(RLS) — 로그인 없이 쓸 수 있으면 안 된다");

  const { data: inserted, error: insertError } = await anon
    .from("sites")
    .insert({
      owner_id: "00000000-0000-0000-0000-000000000000",
      customer_name: "RLS 점검",
      pyeong: 10,
    })
    .select("id");

  if (isNetworkError(insertError)) {
    fail("RLS 확인 중 서버에 닿지 못했습니다");
  } else if (insertError) {
    pass("로그인 없이 현장 등록이 거부됩니다");
  } else {
    fail(
      "로그인 없이 현장이 등록됐습니다 — RLS가 꺼져 있습니다",
      "setup.sql 의 alter table ... enable row level security 부분이 실행됐는지 확인하세요.",
    );
    for (const row of inserted ?? []) {
      await anon.from("sites").delete().eq("id", row.id);
    }
  }

  console.log("\n5. 로그인 서버");

  // getUser()는 세션이 없으면 네트워크를 타지 않는다. 실제로 요청이 나가는
  // 걸 골라야 로그인 서버가 살아 있는지 알 수 있다.
  const probe = await anon.auth.signInWithPassword({
    email: "check-probe@example.invalid",
    password: "not-a-real-password",
  });

  if (isNetworkError(probe.error)) {
    fail("로그인 서버에 닿지 못했습니다");
  } else if (probe.error) {
    // 자격증명이 틀렸다는 응답이 온 것 자체가 서버가 살아 있다는 뜻이다.
    pass("로그인 서버가 응답합니다");
  } else {
    warn("점검용 계정으로 로그인이 됐습니다 — 예상 밖입니다");
    await anon.auth.signOut();
  }

  if (args.email && args.password) {
    await roundTrip(anon, url, key, args);
  } else {
    console.log("\n6. 실제 한 바퀴 돌려보기");
    console.log("      건너뜀. 계정을 주면 실제로 저장까지 해 봅니다:");
    console.log(
      "      npm run check:supabase -- --email 내메일 --password 내비밀번호",
    );
  }

  console.log(
    failed
      ? "\n문제가 있습니다. 위의 → 를 따라 고친 뒤 다시 실행하세요.\n"
      : "\n다 정상입니다. npm run dev 로 띄우면 로그인 화면이 나옵니다.\n",
  );
  process.exitCode = failed ? 1 : 0;
}

/** 로그인해서 실제로 한 바퀴 돌린다. 만든 데이터는 지운다. */
async function roundTrip(anon, url, key, { email, password }) {
  console.log("\n6. 실제 한 바퀴 돌려보기");

  const client = createClient(url, key, { auth: { persistSession: false } });

  let { data: auth, error } = await client.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    const signUp = await client.auth.signUp({ email, password });
    if (signUp.error) {
      fail(`로그인/가입 실패: ${signUp.error.message}`);
      return;
    }
    if (!signUp.data.session) {
      warn("가입은 됐지만 이메일 인증이 필요합니다");
      console.log("      → 받은 메일의 링크를 누른 뒤 다시 실행하세요.");
      return;
    }
    auth = signUp.data;
    pass("새 계정으로 가입했습니다");
  } else {
    pass("로그인 성공");
  }

  const userId = auth.user.id;
  let siteId;

  try {
    const site = await client
      .from("sites")
      .insert({
        owner_id: userId,
        customer_name: "점검용 현장",
        pyeong: 32,
        area_basis: "supply",
        wallpaper_kind: "silk",
        include_ceiling: true,
        status: "inquiry",
        estimate_total: 1_671_760,
      })
      .select("id")
      .single();

    if (site.error) {
      fail(`현장 등록 실패: ${site.error.message}`);
      return;
    }
    siteId = site.data.id;
    pass("현장을 등록했습니다");

    const estimate = await client
      .rpc("create_estimate", {
        p_site_id: siteId,
        p_label: "점검용 견적",
        p_memo: "내부 메모 — 고객에게 보이면 안 됨",
        p_input: { kind: "silk", includeCeiling: true },
        p_result: { total: 1_671_760, items: [] },
        p_total: 1_671_760,
      })
      .single();

    if (estimate.error) {
      fail(`견적 저장 실패: ${estimate.error.message}`);
      return;
    }
    pass(`견적을 저장했습니다 (${estimate.data.version}차)`);

    const shared = await client.rpc("enable_estimate_sharing", {
      p_estimate_id: estimate.data.id,
    });

    if (shared.error || !shared.data) {
      fail(`공유 링크 만들기 실패: ${shared.error?.message ?? "열쇠가 비었습니다"}`);
      return;
    }
    pass(`공유 열쇠를 만들었습니다 (${shared.data.length}자)`);

    // 로그인하지 않은 손님 시점
    const guest = createClient(url, key, { auth: { persistSession: false } });
    const publicView = await guest.rpc("find_shared_estimate", {
      p_token: shared.data,
    });

    if (publicView.error) {
      fail(`공개 견적서 조회 실패: ${publicView.error.message}`);
    } else if (!publicView.data?.length) {
      fail("공개 링크로 아무것도 안 나옵니다");
    } else {
      pass("로그인 없이 공개 견적서가 열립니다");

      const body = JSON.stringify(publicView.data[0]);
      if (body.includes("내부 메모")) {
        fail("공개 견적서에 내부 메모가 들어갔습니다");
      } else {
        pass("내부 메모는 공개 결과에 없습니다");
      }
    }

    const leaked = await guest.from("estimates").select("*");
    if ((leaked.data ?? []).length > 0) {
      fail("로그인 없이 견적 표 전체가 읽힙니다 — RLS를 확인하세요");
    } else {
      pass("로그인 없이 견적 표는 읽히지 않습니다");
    }

    const frozen = await client
      .from("estimates")
      .update({ total: 1 })
      .eq("id", estimate.data.id);

    if (frozen.error) {
      pass("저장된 견적 금액은 수정이 거부됩니다");
    } else {
      fail(
        "저장된 견적 금액이 수정됐습니다",
        "setup.sql 의 revoke update / grant update (share_token) 부분을 확인하세요.",
      );
    }
  } finally {
    if (siteId) {
      const { error: cleanupError } = await client
        .from("sites")
        .delete()
        .eq("id", siteId);
      if (cleanupError) {
        warn(`점검용 데이터를 지우지 못했습니다: ${cleanupError.message}`);
        console.log(`      → 현장 id ${siteId} 를 직접 지워 주세요.`);
      } else {
        pass("점검용 데이터를 지웠습니다");
      }
    }
    await client.auth.signOut();
  }
}

await main();
