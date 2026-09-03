import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Site, SiteInput } from "@/lib/domain/site";
import type { SiteRepository } from "./repository";

/**
 * Supabase 없이도 바로 굴려볼 수 있게 만든 로컬 파일 저장소.
 * 개발/데모 전용이고, 배포 환경에서는 Supabase 저장소가 대신 쓰인다.
 */
const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "sites.json");

/** 파일에 실제로 저장되는 형태. 도메인 모델에 소유자를 붙인 것. */
export interface StoredSite extends Site {
  ownerId: string;
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
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(DATA_FILE, JSON.stringify(sites, null, 2), "utf8");
}

/** 저장 형태에서 소유자를 떼어내 도메인 모델로 만든다. */
export function toSite(stored: StoredSite): Site {
  const { ownerId: _ownerId, ...site } = stored;
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

  async create(ownerId, input: SiteInput, estimateTotal: number) {
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
  },

  async update(id, ownerId, input, estimateTotal) {
    const sites = await readAll();
    const index = sites.findIndex(
      (site) => site.id === id && site.ownerId === ownerId,
    );
    if (index === -1) return null;

    const updated: StoredSite = { ...sites[index], ...input, estimateTotal };
    sites[index] = updated;
    await writeAll(sites);
    return toSite(updated);
  },

  async remove(id, ownerId) {
    const sites = await readAll();
    await writeAll(
      sites.filter((site) => !(site.id === id && site.ownerId === ownerId)),
    );
  },
};
