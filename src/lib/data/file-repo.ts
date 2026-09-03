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

async function readAll(): Promise<Site[]> {
  try {
    const raw = await readFile(DATA_FILE, "utf8");
    return JSON.parse(raw) as Site[];
  } catch {
    return [];
  }
}

async function writeAll(sites: Site[]): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(DATA_FILE, JSON.stringify(sites, null, 2), "utf8");
}

export const fileSiteRepository: SiteRepository = {
  async list() {
    const sites = await readAll();
    return sites.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async get(id) {
    const sites = await readAll();
    return sites.find((site) => site.id === id) ?? null;
  },

  async create(input: SiteInput, estimateTotal: number) {
    const sites = await readAll();
    const site: Site = {
      ...input,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      estimateTotal,
    };
    sites.push(site);
    await writeAll(sites);
    return site;
  },

  async update(id, input, estimateTotal) {
    const sites = await readAll();
    const index = sites.findIndex((site) => site.id === id);
    if (index === -1) return null;

    const updated: Site = { ...sites[index], ...input, estimateTotal };
    sites[index] = updated;
    await writeAll(sites);
    return updated;
  },

  async remove(id) {
    const sites = await readAll();
    await writeAll(sites.filter((site) => site.id !== id));
  },
};
