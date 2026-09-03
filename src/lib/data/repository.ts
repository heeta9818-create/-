import type {
  NewEstimate,
  SavedEstimate,
  SharedEstimate,
} from "@/lib/domain/saved-estimate";
import type { PriceSettings } from "@/lib/domain/settings";
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

  /** 공개 링크를 켠다. 이미 켜져 있으면 기존 열쇠를 그대로 돌려준다. */
  enableSharing(id: string, ownerId: string): Promise<string | null>;
  /** 공개 링크를 끈다. 기존 링크는 즉시 죽는다. */
  disableSharing(id: string, ownerId: string): Promise<void>;
  /** 로그인 없이 열쇠로만 조회한다. 공개 견적서 화면에서 쓴다. */
  findShared(token: string): Promise<SharedEstimate | null>;

  /**
   * 저장된 견적이 하나라도 있는 현장의 id 목록.
   * 단가표를 고쳤을 때 "저장된 견적이 없어서 기본 견적을 쓰는 현장"만
   * 다시 계산하려고 쓴다.
   */
  siteIdsWithEstimates(ownerId: string): Promise<string[]>;
}

export interface SettingsRepository {
  /** 저장한 적이 없으면 기본 단가표를 돌려준다. */
  get(ownerId: string): Promise<PriceSettings>;
  save(ownerId: string, settings: PriceSettings): Promise<void>;
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
let cachedSettings: SettingsRepository | null = null;

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

export async function getSettingsRepository(): Promise<SettingsRepository> {
  if (cachedSettings) return cachedSettings;

  const repo = isSupabaseConfigured()
    ? (await import("./supabase-repo")).supabaseSettingsRepository
    : (await import("./file-repo")).fileSettingsRepository;

  cachedSettings = repo;
  return repo;
}
