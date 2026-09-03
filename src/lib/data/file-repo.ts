import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  NewEstimate,
  SavedEstimate,
  SharedEstimate,
} from "@/lib/domain/saved-estimate";
import type { Site, SiteInput } from "@/lib/domain/site";
import type { EstimateRepository, SiteRepository } from "./repository";

/**
 * Supabase 없이도 바로 굴려볼 수 있게 만든 로컬 파일 저장소.
 * 개발/데모 전용이고, 배포 환경에서는 Supabase 저장소가 대신 쓰인다.
 */
const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "sites.json");
const ESTIMATE_FILE = path.join(DATA_DIR, "estimates.json");

/**
 * 읽고-고쳐서-쓰는 동작을 한 줄로 세운다.
 *
 * 요청이 겹치면 두 요청이 같은 내용을 읽고 각자 덮어써서 한쪽 변경이
 * 사라진다. 더 나쁘게는, 쓰는 중인 파일을 읽으면 내용이 잘려 JSON 파싱이
 * 실패하고 빈 배열로 간주돼 데이터가 통째로 날아간다.
 *
 * 프로세스가 하나일 때만 유효한 잠금이다. 여러 프로세스로 띄울 거라면
 * 파일 저장소를 쓸 게 아니라 Supabase를 붙여야 한다.
 */
let queue: Promise<unknown> = Promise.resolve();

function withLock<T>(operation: () => Promise<T>): Promise<T> {
  const run = queue.then(operation, operation);
  queue = run.catch(() => undefined);
  return run;
}

/**
 * 임시 파일에 쓰고 이름을 바꾼다.
 * writeFile은 먼저 파일을 비우기 때문에, 그 사이에 읽으면 빈 파일을 본다.
 * rename은 원자적이라 읽는 쪽은 항상 완성된 내용만 본다.
 */
async function writeJson(file: string, data: unknown): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  const temp = `${file}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temp, JSON.stringify(data, null, 2), "utf8");
  await rename(temp, file);
}

/** 파일에 실제로 저장되는 형태. 도메인 모델에 소유자와 차수 카운터를 붙인 것. */
export interface StoredSite extends Site {
  ownerId: string;
  /**
   * 이 현장에 매긴 마지막 견적 차수.
   * max(version) + 1로 매기면 중간 차수를 지웠을 때 번호가 재사용된다 —
   * 이미 보낸 "2차 견적"이 나중에 다른 견적을 가리키게 된다.
   * SQL 스키마의 sites.last_estimate_version과 같은 역할.
   */
  lastEstimateVersion?: number;
}

async function readAll(): Promise<StoredSite[]> {
  try {
    const raw = await readFile(DATA_FILE, "utf8");
    return JSON.parse(raw) as StoredSite[];
  } catch {
    return [];
  }
}

async function writeAll(sites: StoredSite[]): Promise<void> {
  await writeJson(DATA_FILE, sites);
}

/** 저장 형태에서 내부 필드를 떼어내 도메인 모델로 만든다. */
export function toSite(stored: StoredSite): Site {
  const { ownerId: _ownerId, lastEstimateVersion: _version, ...site } = stored;
  return site;
}

export const fileSiteRepository: SiteRepository = {
  async list(ownerId) {
    const sites = await readAll();
    return sites
      .filter((site) => site.ownerId === ownerId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(toSite);
  },

  async get(id, ownerId) {
    const sites = await readAll();
    const found = sites.find(
      (site) => site.id === id && site.ownerId === ownerId,
    );
    return found ? toSite(found) : null;
  },

  create(ownerId, input: SiteInput, estimateTotal: number) {
    return withLock(async () => {
      const sites = await readAll();
      const stored: StoredSite = {
        ...input,
        id: randomUUID(),
        ownerId,
        createdAt: new Date().toISOString(),
        estimateTotal,
      };
      sites.push(stored);
      await writeAll(sites);
      return toSite(stored);
    });
  },

  update(id, ownerId, input, estimateTotal) {
    return withLock(async () => {
      const sites = await readAll();
      const index = sites.findIndex(
        (site) => site.id === id && site.ownerId === ownerId,
      );
      if (index === -1) return null;

      const updated: StoredSite = { ...sites[index], ...input, estimateTotal };
      sites[index] = updated;
      await writeAll(sites);
      return toSite(updated);
    });
  },

  remove(id, ownerId) {
    return withLock(async () => {
      const sites = await readAll();
      await writeAll(
        sites.filter((site) => !(site.id === id && site.ownerId === ownerId)),
      );

      // SQL 스키마의 on delete cascade와 동작을 맞춘다.
      const estimates = await readEstimates();
      const remaining = estimates.filter(
        (row) => !(row.siteId === id && row.ownerId === ownerId),
      );
      if (remaining.length !== estimates.length) {
        await writeEstimates(remaining);
      }
    });
  },

  setEstimateTotal(id, ownerId, estimateTotal) {
    return withLock(async () => {
      const sites = await readAll();
      const index = sites.findIndex(
        (site) => site.id === id && site.ownerId === ownerId,
      );
      if (index === -1) return;

      sites[index] = { ...sites[index], estimateTotal };
      await writeAll(sites);
    });
  },
};

/* ---------------------------------------------------------------- 견적 이력 */

export interface StoredEstimate extends SavedEstimate {
  ownerId: string;
}

async function readEstimates(): Promise<StoredEstimate[]> {
  try {
    const raw = await readFile(ESTIMATE_FILE, "utf8");
    return JSON.parse(raw) as StoredEstimate[];
  } catch {
    return [];
  }
}

async function writeEstimates(estimates: StoredEstimate[]): Promise<void> {
  await writeJson(ESTIMATE_FILE, estimates);
}

function toEstimate(stored: StoredEstimate): SavedEstimate {
  const { ownerId: _ownerId, ...estimate } = stored;
  // 공유 기능이 생기기 전에 저장된 건에는 shareToken이 없다.
  return { ...estimate, shareToken: estimate.shareToken ?? null };
}

/** 128비트 무작위 열쇠. 링크를 아는 사람은 누구나 볼 수 있으므로 추측 불가능해야 한다. */
function newShareToken(): string {
  return randomBytes(16).toString("hex");
}

export const fileEstimateRepository: EstimateRepository = {
  async listForSite(siteId, ownerId) {
    const estimates = await readEstimates();
    return estimates
      .filter((row) => row.siteId === siteId && row.ownerId === ownerId)
      .sort((a, b) => b.version - a.version)
      .map(toEstimate);
  },

  async get(id, ownerId) {
    const estimates = await readEstimates();
    const found = estimates.find(
      (row) => row.id === id && row.ownerId === ownerId,
    );
    return found ? toEstimate(found) : null;
  },

  create(ownerId, siteId, data: NewEstimate) {
    return withLock(async () => {
      // 차수는 현장에 붙은 카운터에서 가져온다. 견적을 지워도 번호가 줄지 않는다.
      const sites = await readAll();
      const index = sites.findIndex(
        (site) => site.id === siteId && site.ownerId === ownerId,
      );
      if (index === -1) throw new Error("현장을 찾을 수 없습니다");

      const version = (sites[index].lastEstimateVersion ?? 0) + 1;
      sites[index] = { ...sites[index], lastEstimateVersion: version };
      await writeAll(sites);

      const estimates = await readEstimates();
      const stored: StoredEstimate = {
        ...data,
        id: randomUUID(),
        ownerId,
        siteId,
        version,
        createdAt: new Date().toISOString(),
        total: data.result.total,
        shareToken: null,
      };

      estimates.push(stored);
      await writeEstimates(estimates);
      return toEstimate(stored);
    });
  },

  remove(id, ownerId) {
    return withLock(async () => {
      const estimates = await readEstimates();
      await writeEstimates(
        estimates.filter((row) => !(row.id === id && row.ownerId === ownerId)),
      );
    });
  },

  enableSharing(id, ownerId) {
    return withLock(async () => {
      const estimates = await readEstimates();
      const index = estimates.findIndex(
        (row) => row.id === id && row.ownerId === ownerId,
      );
      if (index === -1) return null;

      // 이미 켜져 있으면 링크를 바꾸지 않는다. 고객에게 이미 보낸 링크가
      // 다시 공유했다는 이유로 죽으면 안 된다.
      const existing = estimates[index].shareToken;
      if (existing) return existing;

      const token = newShareToken();
      estimates[index] = { ...estimates[index], shareToken: token };
      await writeEstimates(estimates);
      return token;
    });
  },

  disableSharing(id, ownerId) {
    return withLock(async () => {
      const estimates = await readEstimates();
      const index = estimates.findIndex(
        (row) => row.id === id && row.ownerId === ownerId,
      );
      if (index === -1) return;

      estimates[index] = { ...estimates[index], shareToken: null };
      await writeEstimates(estimates);
    });
  },

  async findShared(token) {
    if (!token) return null;

    const estimates = await readEstimates();
    const found = estimates.find((row) => row.shareToken === token);
    if (!found) return null;

    const sites = await readAll();
    const site = sites.find((row) => row.id === found.siteId);
    if (!site) return null;

    // 메모는 일부러 뺀다. 고객에게 보일 내용이 아니다.
    return {
      version: found.version,
      label: found.label,
      createdAt: found.createdAt,
      input: found.input,
      result: found.result,
      customerName: site.customerName,
      address: site.address ?? "",
    } satisfies SharedEstimate;
  },
};
