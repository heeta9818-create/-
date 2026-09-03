import type { Site, SiteInput, SiteStatus } from "@/lib/domain/site";
import type { WallpaperKind } from "@/lib/domain/wallpaper";
import type { SiteRepository } from "./repository";
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
};
