import type { EstimateInput, EstimateResult } from "@/lib/domain/estimate";
import type {
  NewEstimate,
  SavedEstimate,
  SharedEstimate,
} from "@/lib/domain/saved-estimate";
import type { Site, SiteInput, SiteStatus } from "@/lib/domain/site";
import type { WallpaperKind } from "@/lib/domain/wallpaper";
import type { EstimateRepository, SiteRepository } from "./repository";
import { createSupabaseServerClient } from "./supabase/server";

/** DB 컬럼(snake_case) ↔ 도메인 모델(camelCase) 변환 */
interface SiteRow {
  id: string;
  created_at: string;
  customer_name: string;
  phone: string | null;
  address: string | null;
  pyeong: number;
  area_basis: "supply" | "exclusive";
  wallpaper_kind: WallpaperKind;
  include_ceiling: boolean;
  patterned: boolean;
  scheduled_on: string | null;
  status: SiteStatus;
  memo: string | null;
  estimate_total: number;
}

function toSite(row: SiteRow): Site {
  return {
    id: row.id,
    createdAt: row.created_at,
    customerName: row.customer_name,
    phone: row.phone ?? "",
    address: row.address ?? "",
    pyeong: row.pyeong,
    areaBasis: row.area_basis,
    wallpaperKind: row.wallpaper_kind,
    includeCeiling: row.include_ceiling,
    patterned: row.patterned,
    scheduledOn: row.scheduled_on ?? "",
    status: row.status,
    memo: row.memo ?? "",
    estimateTotal: row.estimate_total,
  };
}

function toRow(input: SiteInput, estimateTotal: number) {
  return {
    customer_name: input.customerName,
    phone: input.phone || null,
    address: input.address || null,
    pyeong: input.pyeong,
    area_basis: input.areaBasis,
    wallpaper_kind: input.wallpaperKind,
    include_ceiling: input.includeCeiling,
    patterned: input.patterned,
    scheduled_on: input.scheduledOn || null,
    status: input.status,
    memo: input.memo || null,
    estimate_total: estimateTotal,
  };
}

/**
 * owner_id 조건은 RLS와 중복이다. 일부러 남겨 둔다 — 정책을 잘못 손대는
 * 순간 조용히 남의 데이터가 새는 것보다, 쿼리에도 조건이 박혀 있는 편이 낫다.
 */
export const supabaseSiteRepository: SiteRepository = {
  async list(ownerId) {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("sites")
      .select("*")
      .eq("owner_id", ownerId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data as SiteRow[]).map(toSite);
  },

  async get(id, ownerId) {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("sites")
      .select("*")
      .eq("id", id)
      .eq("owner_id", ownerId)
      .maybeSingle();

    if (error) throw error;
    return data ? toSite(data as SiteRow) : null;
  },

  async create(ownerId, input, estimateTotal) {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("sites")
      .insert({ ...toRow(input, estimateTotal), owner_id: ownerId })
      .select("*")
      .single();

    if (error) throw error;
    return toSite(data as SiteRow);
  },

  async update(id, ownerId, input, estimateTotal) {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("sites")
      .update(toRow(input, estimateTotal))
      .eq("id", id)
      .eq("owner_id", ownerId)
      .select("*")
      .maybeSingle();

    if (error) throw error;
    return data ? toSite(data as SiteRow) : null;
  },

  async remove(id, ownerId) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from("sites")
      .delete()
      .eq("id", id)
      .eq("owner_id", ownerId);
    if (error) throw error;
  },

  async setEstimateTotal(id, ownerId, estimateTotal) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from("sites")
      .update({ estimate_total: estimateTotal })
      .eq("id", id)
      .eq("owner_id", ownerId);
    if (error) throw error;
  },
};

/* ---------------------------------------------------------------- 견적 이력 */

interface EstimateRow {
  id: string;
  site_id: string;
  created_at: string;
  version: number;
  label: string | null;
  memo: string | null;
  input: EstimateInput;
  result: EstimateResult;
  total: number;
  share_token: string | null;
}

function toEstimate(row: EstimateRow): SavedEstimate {
  return {
    id: row.id,
    siteId: row.site_id,
    createdAt: row.created_at,
    version: row.version,
    label: row.label ?? "",
    memo: row.memo ?? "",
    input: row.input,
    result: row.result,
    total: row.total,
    shareToken: row.share_token ?? null,
  };
}

export const supabaseEstimateRepository: EstimateRepository = {
  async listForSite(siteId, ownerId) {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("estimates")
      .select("*")
      .eq("site_id", siteId)
      .eq("owner_id", ownerId)
      .order("version", { ascending: false });

    if (error) throw error;
    return (data as EstimateRow[]).map(toEstimate);
  },

  async get(id, ownerId) {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("estimates")
      .select("*")
      .eq("id", id)
      .eq("owner_id", ownerId)
      .maybeSingle();

    if (error) throw error;
    return data ? toEstimate(data as EstimateRow) : null;
  },

  async create(ownerId, siteId, data: NewEstimate) {
    const supabase = await createSupabaseServerClient();

    // 차수는 DB 함수가 매긴다. 앱에서 조회 후 +1 하면 동시에 두 건이
    // 저장될 때 같은 차수가 두 번 나올 수 있다.
    const { data: row, error } = await supabase
      .rpc("create_estimate", {
        p_site_id: siteId,
        p_label: data.label || null,
        p_memo: data.memo || null,
        p_input: data.input,
        p_result: data.result,
        p_total: data.result.total,
      })
      .single();

    if (error) throw error;
    return toEstimate(row as EstimateRow);
  },

  async remove(id, ownerId) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from("estimates")
      .delete()
      .eq("id", id)
      .eq("owner_id", ownerId);
    if (error) throw error;
  },

  async enableSharing(id, _ownerId) {
    // 열쇠 생성과 "이미 있으면 그대로" 판단을 DB 함수가 한 번에 한다.
    // 앱에서 읽고 없으면 쓰는 식이면 동시에 두 번 눌렀을 때 링크가 갈린다.
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("enable_estimate_sharing", {
      p_estimate_id: id,
    });

    if (error) throw error;
    return (data as string | null) ?? null;
  },

  async disableSharing(id, ownerId) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from("estimates")
      .update({ share_token: null })
      .eq("id", id)
      .eq("owner_id", ownerId);
    if (error) throw error;
  },

  async findShared(token) {
    if (!token) return null;

    // RLS를 우회하는 security definer 함수다. 열쇠 일치 한 건만 꺼내고
    // 내부 메모나 연락처는 애초에 돌려주지 않는다.
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .rpc("find_shared_estimate", { p_token: token })
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    const row = data as {
      version: number;
      label: string;
      created_at: string;
      input: EstimateInput;
      result: EstimateResult;
      customer_name: string;
      address: string;
    };

    return {
      version: row.version,
      label: row.label ?? "",
      createdAt: row.created_at,
      input: row.input,
      result: row.result,
      customerName: row.customer_name,
      address: row.address ?? "",
    } satisfies SharedEstimate;
  },
};
