import type { Site, SiteInput } from "@/lib/domain/site";

export interface SiteRepository {
  list(): Promise<Site[]>;
  get(id: string): Promise<Site | null>;
  create(input: SiteInput, estimateTotal: number): Promise<Site>;
  update(id: string, input: SiteInput, estimateTotal: number): Promise<Site | null>;
  remove(id: string): Promise<void>;
}

/** Supabase 환경변수가 모두 있으면 Supabase를, 없으면 로컬 파일 저장소를 쓴다. */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

let cached: SiteRepository | null = null;

export async function getSiteRepository(): Promise<SiteRepository> {
  if (cached) return cached;

  const repo = isSupabaseConfigured()
    ? (await import("./supabase-repo")).supabaseSiteRepository
    : (await import("./file-repo")).fileSiteRepository;

  cached = repo;
  return repo;
}
