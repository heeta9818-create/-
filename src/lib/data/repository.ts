import type { NewEstimate, SavedEstimate } from "@/lib/domain/saved-estimate";
import type { Site, SiteInput } from "@/lib/domain/site";

/**
 * 모든 메서드가 ownerId를 받는다.
 * Supabase 쪽은 RLS로도 막혀 있지만, 저장소 계층에서도 한 번 더 거른다.
 * 로컬 파일 저장소에는 RLS가 없으니 여기가 유일한 방어선이기도 하다.
 */
export interface SiteRepository {
  list(ownerId: string): Promise<Site[]>;
  get(id: string, ownerId: string): Promise<Site | null>;
  create(ownerId: string, input: SiteInput, estimateTotal: number): Promise<Site>;
  update(
    id: string,
    ownerId: string,
    input: SiteInput,
    estimateTotal: number,
  ): Promise<Site | null>;
  remove(id: string, ownerId: string): Promise<void>;
  /** 견적을 저장했을 때 목록·대시보드에 보이는 금액만 갱신한다. */
  setEstimateTotal(
    id: string,
    ownerId: string,
    estimateTotal: number,
  ): Promise<void>;
}

export interface EstimateRepository {
  listForSite(siteId: string, ownerId: string): Promise<SavedEstimate[]>;
  get(id: string, ownerId: string): Promise<SavedEstimate | null>;
  create(
    ownerId: string,
    siteId: string,
    data: NewEstimate,
  ): Promise<SavedEstimate>;
  remove(id: string, ownerId: string): Promise<void>;
}

/** Supabase 환경변수가 모두 있으면 Supabase를, 없으면 로컬 파일 저장소를 쓴다. */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

let cachedSites: SiteRepository | null = null;
let cachedEstimates: EstimateRepository | null = null;

export async function getSiteRepository(): Promise<SiteRepository> {
  if (cachedSites) return cachedSites;

  const repo = isSupabaseConfigured()
    ? (await import("./supabase-repo")).supabaseSiteRepository
    : (await import("./file-repo")).fileSiteRepository;

  cachedSites = repo;
  return repo;
}

export async function getEstimateRepository(): Promise<EstimateRepository> {
  if (cachedEstimates) return cachedEstimates;

  const repo = isSupabaseConfigured()
    ? (await import("./supabase-repo")).supabaseEstimateRepository
    : (await import("./file-repo")).fileEstimateRepository;

  cachedEstimates = repo;
  return repo;
}
